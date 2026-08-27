#include "ccx/render/render_graph.h"

#include <algorithm>
#include <cstdio>
#include <unordered_map>
#include <unordered_set>

namespace ccx::render {

void RenderGraph::declareResource(std::string name, ResourceKind kind) {
    for (const auto& r : resources_) {
        if (r.name == name) return;
    }
    resources_.push_back({std::move(name), kind});
}

void RenderGraph::addPass(Pass p) { passes_.push_back(std::move(p)); }

CompileResult RenderGraph::compile() const {
    CompileResult out;

    // 1) 资源引用校验
    auto resourceIndex = [&](const std::string& name, const char* who) -> int {
        for (size_t i = 0; i < resources_.size(); ++i) {
            if (resources_[i].name == name) return static_cast<int>(i);
        }
        out.error = std::string("未声明资源: ") + name + "（pass: " + who + "）";
        return -1;
    };
    for (const Pass& p : passes_) {
        for (const std::string& r : p.reads) {
            if (resourceIndex(r, p.name.c_str()) < 0) return out;
        }
        for (const std::string& r : p.writes) {
            if (resourceIndex(r, p.name.c_str()) < 0) return out;
        }
    }

    // 2) transient 生命周期：读取不得发生在首次写入（按添加序）之前；
    //    显式 after 可覆盖（pipeline 资产内声明的顺序优先）
    {
        std::unordered_map<std::string, size_t> firstWriterIdx;
        for (size_t i = 0; i < passes_.size(); ++i) {
            for (const std::string& r : passes_[i].writes) {
                if (!firstWriterIdx.count(r)) firstWriterIdx[r] = i;
            }
        }
        for (size_t i = 0; i < passes_.size(); ++i) {
            const Pass& p = passes_[i];
            for (const std::string& r : p.reads) {
                const auto it = firstWriterIdx.find(r);
                if (it == firstWriterIdx.end()) {
                    // 从未被写入：External 允许，Transient 拒绝
                    const int ri = resourceIndex(r, p.name.c_str());
                    if (ri >= 0 && resources_[static_cast<size_t>(ri)].kind ==
                                      ResourceKind::Transient) {
                        out.error = "transient 资源从未被写入却被读取: " + r;
                        return out;
                    }
                    continue;
                }
                if (it->second > i) {
                    // 读取 pass 在首次写入 pass 之前声明：需显式 after 覆盖
                    bool ordered = false;
                    const std::string w = passes_[it->second].name;
                    for (const std::string& a : p.after) {
                        if (a == w) { ordered = true; break; }
                    }
                    if (!ordered) {
                        out.error = "transient 资源在写入前被读取: " + r +
                                    "（pass " + p.name + " 读取，首次写入在 " + w +
                                    "；请用 after 显式排序）";
                        return out;
                    }
                }
            }
        }
    }

    // 3) 写-写冲突：同一资源被两个 pass 写入且无 after 约束 -> 错误
    {
        for (size_t i = 0; i < passes_.size(); ++i) {
            const Pass& a = passes_[i];
            for (size_t j = i + 1; j < passes_.size(); ++j) {
                const Pass& b = passes_[j];
                for (const std::string& r : a.writes) {
                    if (std::find(b.writes.begin(), b.writes.end(), r) == b.writes.end()) {
                        continue;
                    }
                    bool ordered = false;
                    for (const std::string& x : b.after) {
                        if (x == a.name) { ordered = true; break; }
                    }
                    for (const std::string& x : a.after) {
                        if (x == b.name) { ordered = true; break; }
                    }
                    if (!ordered) {
                        out.error = "写-写冲突: " + r + "（" + a.name + " 与 " + b.name +
                                    " 同时写入，需显式 after）";
                        return out;
                    }
                }
            }
        }
    }

    // 4) 执行序：添加序 + after 拓扑（Kahn；环 -> 错误）
    const size_t n = passes_.size();
    std::unordered_map<std::string, size_t> byName;
    for (size_t i = 0; i < n; ++i) {
        if (byName.count(passes_[i].name)) {
            out.error = "pass 重名: " + passes_[i].name;
            return out;
        }
        byName.emplace(passes_[i].name, i);
    }
    std::vector<std::vector<size_t>> edges(n);
    std::vector<size_t> indeg(n, 0);
    for (size_t i = 0; i < n; ++i) {
        for (const std::string& a : passes_[i].after) {
            const auto it = byName.find(a);
            if (it == byName.end()) {
                out.error = "after 引用了不存在的 pass: " + a;
                return out;
            }
            edges[it->second].push_back(i);
            ++indeg[i];
        }
    }
    std::vector<size_t> order;
    order.reserve(n);
    std::vector<bool> done(n, false);
    for (;;) {
        bool progressed = false;
        for (size_t i = 0; i < n; ++i) {
            if (done[i] || indeg[i] != 0) continue;
            done[i] = true;
            order.push_back(i);
            for (const size_t e : edges[i]) --indeg[e];
            progressed = true;
        }
        if (!progressed) break;
    }
    if (order.size() != n) {
        out.error = "pass 依赖存在环";
        return out;
    }
    for (const size_t i : order) out.executionOrder.push_back(passes_[i].name);

    // 5) transient 生命周期（供资源池/别名使用，renderer-spec §3.3）
    for (const ResourceDecl& rd : resources_) {
        ResourceLifecycle lc;
        lc.name = rd.name;
        lc.kind = rd.kind;
        for (const size_t i : order) {
            const Pass& p = passes_[i];
            if (std::find(p.writes.begin(), p.writes.end(), rd.name) != p.writes.end()) {
                if (lc.firstWrittenBy.empty()) lc.firstWrittenBy = p.name;
            }
            if (std::find(p.reads.begin(), p.reads.end(), rd.name) != p.reads.end()) {
                lc.lastReadBy = p.name;
            }
        }
        out.lifecycles.push_back(std::move(lc));
    }

    out.ok = true;
    return out;
}

}  // namespace ccx::render
