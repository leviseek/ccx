// 假压缩器（测试用）：读源文件，输出 "compressed:<bytes>" 模拟产物
import { readFileSync } from 'node:fs';
const src = process.argv[2];
await readFileSync(src);
process.stdout.write('compressed:' + src.length);
