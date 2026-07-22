# 人工智能训练师（三级）刷题网页

这是一个可部署到 GitHub Pages 的静态刷题网页，包含 900 道理论复习题、答案解析、成功率统计、错题复习和跨设备同步入口。

## GitHub Pages

仓库开启 Pages 后，发布源选择：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

## 跨设备同步

GitHub Pages 只能展示静态网页，不能保存用户做题进度。跨设备同步需要配置一个云端数据表。本项目已内置 Supabase REST 同步适配，适合多用户场景。

### 1. 创建 Supabase 表

在 Supabase SQL Editor 执行：

```sql
create table if not exists practice_progress (
  user_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table practice_progress enable row level security;

create policy "allow anonymous progress read"
on practice_progress for select
to anon
using (true);

create policy "allow anonymous progress insert"
on practice_progress for insert
to anon
with check (true);

create policy "allow anonymous progress update"
on practice_progress for update
to anon
using (true)
with check (true);
```

说明：网页会把“同步账号 + 同步口令”在浏览器里做 SHA-256 哈希后作为 `user_key`。不同用户使用不同账号/口令即可互相隔离；同一用户在手机、电脑、平板输入同一组账号/口令即可同步。

### 2. 填写同步配置

编辑 `sync-config.js`：

```js
window.SYNC_CONFIG = {
  provider: "supabase",
  supabaseUrl: "https://你的项目.supabase.co",
  supabaseAnonKey: "你的 anon public key",
  table: "practice_progress",
};
```

提交并推送后，手机访问 GitHub Pages 页面，输入同一组“同步账号”和“同步口令”，点击“开启同步”。

## 注意

- 如果没有配置 Supabase，网页仍可正常本机刷题，进度保存在当前浏览器。
- 同步口令不应使用重要密码；建议为刷题单独设置。
- 若多人共用同一同步账号和口令，进度会合并到同一个空间。
