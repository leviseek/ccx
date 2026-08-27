#include "ccx/render/pipeline.h"

#include <algorithm>
#include <unordered_map>

namespace ccx::render {

bool parsePipeline(const json::Value& doc, PipelineDef& out, std::string& err) {
    if (doc.kind() != json::Kind::Object) {
        err = "pipeline: 根节点必须是对象";
        return false;
    }
    const json::Value* schema = doc.find("schema");
    if (schema == nullptr || schema->kind() != json::Kind::String ||
        schema->asString() != "ccx.pipeline/1") {
        err = "pipeline: 缺少或错误的 schema（需要 ccx.pipeline/1）";
        return false;
    }
    out.schema = schema->asString();
    if (const json::Value* n = doc.find("name")) out.name = n->asString();
    if (const json::Value* e = doc.find("extends")) out.extends = e->asString();

    const json::Value* res = doc.find("resources");
    if (res == nullptr || res->kind() != json::Kind::Object) {
        err = "pipeline: 缺少 resources";
        return false;
    }
    for (const auto& [name, v] : res->asObject()) {
        PipelineResource r;
        r.name = name;
        if (const json::Value* f = v.find("format")) r.format = f->asString();
        if (const json::Value* s = v.find("size")) r.size = s->asString();
        if (const json::Value* u = v.find("usage")) r.external = u->asString() == "external";
        out.resources.push_back(std::move(r));
    }

    const json::Value* passes = doc.find("passes");
    if (passes == nullptr || passes->kind() != json::Kind::Array) {
        err = "pipeline: 缺少 passes";
        return false;
    }
    for (const json::Value& pv : passes->asArray()) {
        PipelinePass p;
        if (const json::Value* id = pv.find("id")) p.id = id->asString();
        if (const json::Value* t = pv.find("target")) p.target = t->asString();
        if (const json::Value* sh = pv.find("shader")) p.shader = sh->asString();
        if (const json::Value* st = pv.find("sort")) p.sort = st->asString();
        if (const json::Value* en = pv.find("enable")) p.enable = en->asBool();
        if (const json::Value* rd = pv.find("reads")) {
            for (const json::Value& x : rd->asArray()) p.reads.push_back(x.asString());
        }
        if (const json::Value* af = pv.find("after")) {
            for (const json::Value& x : af->asArray()) p.after.push_back(x.asString());
        }
        out.passes.push_back(std::move(p));
    }

    const json::Value* mf = doc.find("minFeatures");
    if (mf != nullptr && mf->kind() == json::Kind::Object) {
        for (const auto& [k, v] : mf->asObject()) {
            (void)v;
            out.minFeatures.push_back(k);
        }
    }
    return true;
}

CompileResult compilePipeline(const PipelineDef& def,
                              const std::vector<std::string>& caps) {
    CompileResult out;
    // 0) minFeatures 降级门槛（renderer-spec §2.4/§5）
    for (const std::string& f : def.minFeatures) {
        if (std::find(caps.begin(), caps.end(), f) == caps.end()) {
            out.ok = false;
            out.error = "pipeline 缺少能力: " + f;
            return out;
        }
    }

    // 1) 资源声明（targets/reads 引用的资源必须是已声明或 backbuffer）
    RenderGraph g;
    for (const PipelineResource& r : def.resources) {
        g.declareResource(r.name, r.external ? ResourceKind::External
                                             : ResourceKind::Transient);
    }

    // 2) 启用 pass 构建 RenderGraph（禁用 pass 剔除；target 自动补 reads 语义依赖）
    std::vector<PipelinePass> enabled;
    for (const PipelinePass& p : def.passes) {
        if (p.enable) enabled.push_back(p);
    }
    if (enabled.empty()) {
        out.ok = false;
        out.error = "pipeline: 没有启用的 pass";
        return out;
    }
    // 同一 target 的连续写者隐式串联（按资产添加序），显式 after 优先
    std::unordered_map<std::string, std::string> lastWriter;
    for (const PipelinePass& p : enabled) {
        if (p.target.empty()) {
            out.ok = false;
            out.error = "pass 缺少 target: " + p.id;
            return out;
        }
        Pass gp;
        gp.name = p.id;
        gp.writes.push_back(p.target);
        gp.reads = p.reads;
        gp.after = p.after;
        const auto itw = lastWriter.find(p.target);
        if (itw != lastWriter.end()) {
            bool already = false;
            for (const std::string& a : gp.after) {
                if (a == itw->second) { already = true; break; }
            }
            if (!already) gp.after.push_back(itw->second);  // 隐式链: 上一写者
        }
        lastWriter[p.target] = p.id;
        g.addPass(std::move(gp));
    }

    // 3) 交给 RenderGraph 编译器（未声明资源/顺序冲突/环都会在此报错）
    return g.compile();
}

}  // namespace ccx::render
