# 全场解码：服务配置

网站代码已准备好，但需要把自己的 Supabase、DeepSeek 和 Turnstile 配置填入服务，AI 与账号才会真正上线。不要把 DeepSeek 密钥或 Supabase `service_role` / secret key 放进网页或发到聊天里。

## 1. 配置网页公开参数

在 Supabase 项目设置的 API 页面复制 Project URL 与 publishable/anon key，在 Cloudflare Turnstile 创建一个站点后复制 Site Key。把它们填进 `dist/config.js`：

- `supabaseUrl`：Supabase 项目 URL。
- `supabasePublishableKey`：Supabase 公钥（`sb_publishable_...` 或 anon key）；不要使用 secret/service role key。
- `turnstileSiteKey`：Cloudflare Turnstile Site Key。

Cloudflare 的 Turnstile Secret Key 要填在 Supabase Auth 的 CAPTCHA 设置里；网页文件中只放 Site Key。

## 2. 建立 Supabase 数据表和 AI 服务

登录 Supabase 后，在 SQL Editor 运行 `supabase/migrations/202609240001_basketball_features.sql`。额度按北京时间每天重置，每账号最多 30 次；为控制未验证手机号账号带来的费用风险，全站每日也最多 300 次。然后将 `supabase/functions/analyze/index.ts` 部署为名为 `analyze` 的 Edge Function，并保持 JWT 验证开启。可以用 Supabase CLI：

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy analyze
supabase functions deploy nba-data
supabase secrets set DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY DEEPSEEK_MODEL=deepseek-flash
```

也可在 Supabase Dashboard 的 Function 编辑器部署函数，并在 Edge Function Secrets 中添加 `DEEPSEEK_API_KEY`。如果静态 JSON 尚未生成，网页会先直接读取公开 CSV，跨域受限时再调用只返回这份公开 CSV 的 `nba-data` 函数；它无需登录，也不消耗 AI 额度。API 密钥应从 DeepSeek 开放平台获取；切勿提交到 Git。

## 3. 配置账号、人机验证和回跳地址

当前试运行版仅启用邮箱/密码登录，并关闭邮箱确认，因此用户注册后可直接登录。手机号登录未启用，也不会发送短信。

在 Auth CAPTCHA 设置里启用 Cloudflare Turnstile 并填入 Secret Key；Turnstile 站点允许域名加入 `yanyipeng1224.github.io`。Site URL 设置为 `https://yanyipeng1224.github.io`，Redirect URLs 加入 `https://yanyipeng1224.github.io/basketball-playstyle-lab/**`。函数 CORS 已限制到该 GitHub Pages 域名，以及本地 `localhost:5500` / `127.0.0.1:5500`。

当前没有配置自定义 SMTP，网站已明确提示用户：注册后可直接登录，但忘记密码无法自助找回。准备面向公众长期开放前，应先配置 SMTP，再启用邮箱确认和密码重置邮件。

**公开提供邮箱注册、验证和密码重置前，必须配置自定义 SMTP 发信服务。** Supabase 默认邮件服务只向项目团队成员发送邮件，并且每小时最多 2 封；公开用户无法靠它完成邮箱验证或找回密码。选定 SMTP 服务后，在 Supabase Auth 的 SMTP 设置中填入主机、端口、用户名、密码和发件地址。发件域名通常需要在服务商处验证。

## 4. 准备 NBA 静态数据

发布前在有网络的 Node.js 环境运行：

```sh
npm run nba:data
```

脚本会从 BoxScore Lab 下载 2025–26 球员赛季数据，生成 `dist/data/nba-2025-26.json`。页面也会在没有打包文件时尝试从公开 CSV 载入，跨域受限时再调用 `nba-data` 函数。数据按 CC BY 4.0 标注来源与日期。

## 5. 部署网页

此仓库的 GitHub Pages 当前从 `main` 分支根目录发布，因此需要将 `dist/index.html` 与 `dist/config.js` 放到发布根目录；如果生成了 NBA JSON，还要把 `dist/data/nba-2025-26.json` 一并放到根目录的 `data/` 子目录。由于投篮动作分析需要摄像头权限，网站必须通过 HTTPS 打开（GitHub Pages 默认支持）。视频文件和摄像头画面仅在浏览器本机处理；发给 DeepSeek 的只有动作关键点统计值。

投篮动作分析所需的 MediaPipe 程序、WASM 和姿势模型必须随网站放在 `assets/mediapipe/`，避免访客分析时再连接外部 CDN 或 Google Storage。GitHub 仓库中的 `Vendor MediaPipe pose model` 工作流可以手动下载并提交这些固定版本文件。

## 6. Phase 2B PlayerProfile migration

`supabase/migrations/202609250001_player_profiles.sql` 只新增 `player_profiles`、专用更新时间函数、trigger 和 RLS policy，不修改或删除 `app_records`、`shot_attempts`、`training_logs` 或 AI 用量表。DDL migration 由 Supabase migration version 管理，不应在 SQL Editor 中反复手工执行。

执行前必须只读核对目标项目：

- `public.app_records.id` 的实际类型仍为 `uuid`。
- 类型、数据和时间字段仍为 `kind`、`payload jsonb`、`created_at timestamptz`。
- `public.player_profiles` 尚不存在。
- `public.set_player_profiles_updated_at()` 和同名 trigger 尚不存在。
- 目标项目与 `config.js` 使用的是同一个预期开发/验证项目。

核对通过后才可用 Supabase migration 流程应用文件。应用后必须使用 anon key 和两个真实测试账号的 authenticated JWT 测试 RLS。service role 只能用于准备或清理测试账号，不能作为 RLS 测试请求主体。至少验证 A→A 允许、A→B 拒绝、B→A 拒绝、anon 拒绝、伪造其他 `user_id` 拒绝及 DELETE 拒绝。

业务数据同步和 DDL migration 是两种不同的幂等：DDL 由 migration version 保证只执行一次；guest 同步和旧 `app_records` 惰性迁移必须依靠 `user_id` 主键、insert-only、写后重读和冲突处理保证可重试。

回滚前先停止发布依赖新表的网页版本。若新表尚无真实数据，可在明确确认后删除新 policies、trigger、专用函数和表；若已有真实数据，先导出备份，并优先保留停用的表而不是直接删除。回滚不得修改旧表、旧记录或旧 localStorage key。
