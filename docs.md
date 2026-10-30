# 快鹭周报 API 调用说明

接口基址：{API_BASE}

在线说明：https://yuruizhang688-cloud.github.io/kuailu-ppt-api-docs/

本文档免登录公开访问；接口 Key 由提供者私下发放。

将在线说明链接和单独的「接口Key.txt」交给 Codex，即可按下述 HTTP 接口调用。不需要安装 Skill、MCP 插件、PPT 模板或生成软件。调用方 Codex 需要具备联网 HTTP 请求能力；输入材料仍需由使用者提供。

本服务在提供者的电脑运行：原始材料由该电脑上的 Codex 统一整理，使用锁定的快鹭周报原生 React 模板、字体和导出引擎生成 PPTX。首批仅支持快鹭科技、CRM/会议两条产品线、W3 模板固定22页。PPT采用原生流程的整页图像导出，文字不能在 PowerPoint 内逐项编辑；修改内容需重新提交。

文档由 GitHub Pages 独立托管，提供者电脑关机也可阅读。生成 API 在提供者电脑上运行。

## 先读取当前接口地址

固定连接信息地址：https://api.github.com/repos/yuruizhang688-cloud/kuailu-ppt-api-docs/contents/connection.json?ref=runtime

每次开始调用，先匿名 GET 上述地址，设置请求头 Accept: application/vnd.github.raw+json，并附加 &_=当前时间戳 避免缓存，读取 JSON 的 base_url 作为下文的 {API_BASE}。连接信息只记录最新登记地址，updated_at 不是实时在线证明。隧道重建后自动更新此记录，文档链接和 API Key 不变。若连接失败，重新读取 base_url，再用原 idempotency_key 和原请求重试；不要创建重复任务。连接信息只在新任务开始或连接失败时读取，不要随每5秒任务轮询重复读取；遇到公共访问限流时稍后重试。

## 直接交给 Codex 的指令

> 请阅读这份 API 说明，使用我提供的接口Key调用远程快鹭周报生成服务。先从固定连接信息地址读取最新 base_url，再查询模板版本；连接失败时刷新地址并保留原幂等键重试。然后将我提供的本期完整材料作为 materials 提交，不要在本机另做一份 PPT。保留 idempotency_key 和 job_id，每5秒查询一次任务。needs_input 时向我索取返回的 missing 缺项；succeeded 时下载 pptx_url，并同时提供 preview_url 全稿预览。不要在聊天、日志或仓库中输出完整 Key。

## 认证

所有 /v1/ 接口都需要以下请求头，API Key 是「接口Key.txt」中的整行文本：

    Authorization: Bearer <API_KEY>

POST 还需 Content-Type: application/json。Key 独立于提供者的 OpenAI 登录凭据；仅可查询自身创建的任务。请私下交付 Key。

## 四步调用

1. GET {API_BASE}/v1/templates

响应 templates[0] 包含 id、version、slide_count。每次新任务先读取最新 version，不要把示例版本写死。

2. GET {API_BASE}/v1/templates/kuailu-weekly-w3

返回 pages（固定22页页序）、required_materials 和 content_schema（完整 JSON Schema）。材料需包含周期、汇报人、工作总结、监测指标与上期对比、平台/场景/竞品数据、引用来源、发文及渠道统计、品牌认知、下周计划及资料来源。词云可不提供；其他必填事实缺失时不会自动编造。

3. POST {API_BASE}/v1/presentations

推荐材料模式，材料在服务端由同一 Codex 流程整理：

```json
{
  "template_id": "kuailu-weekly-w3",
  "template_version": "替换为步骤1返回的version",
  "idempotency_key": "kuailu-20261030-v1",
  "materials": "在此粘贴本期完整资料，支持文本、Markdown、CSV或JSON文本。仅写本周工作概述不足以生成22页报告。",
  "instructions": "保持原文和数字，不补造事实；没有词云则留空。"
}
```

也可将 materials 替换为符合 content_schema 的完整 content 对象；此模式跳过 AI 整理，直接校验和渲染，instructions 不参与改写。content 和 materials 必须且只能提供一个。系统不读取调用者本地文件，也不抓取材料中的网址；先把附件解析成文本再提交。词云以 PNG/JPEG data URI 放入 content 的 image 字段，或留空字符串。

HTTP 202 返回 job_id、report_id、status、template_version。idempotency_key 为8～100位字母、数字、下划线或短横线。同身份、同 idempotency_key、同请求重试只返回原任务；修改内容时更换 idempotency_key，认证用的 API Key 保持不变。请求超时先用原请求和原 idempotency_key 重试，不要重复创建。

4. GET {API_BASE}/v1/jobs/<job_id>

每5秒查询一次。完整生成通常需要数分钟，AI 整理时间取决于材料长度和本机模型。任务持久保存，可稍后继续查询。

| status | 使用者动作 |
|---|---|
| queued / running | 等待并继续查询；phase 和 completed_slides 显示进度 |
| retry_wait | 服务端正在自动重试，按 next_retry_at 继续查询，勿重复提交 |
| needs_input | 读取 missing，补齐资料后用新的 idempotency_key 提交完整材料 |
| succeeded | 下载 pptx_url，同时打开 preview_url；validation_url 提供渲染检查结果 |
| failed | 保存 job_id 和 error，联系提供者检查运行环境 |

成功结果含22页 PPTX及相同 report_id、相同页序和组件的 WeeklyDeckPreview 全稿静态预览。点击每页缩略图可进入单页。返回的文件/预览链接24小时有效，持有链接者可访问该报告；过期后再次 GET 任务即可刷新。local_preview_url 仅供提供者电脑使用，异地使用 preview_url。

## Python 示例（仅标准库）

把 Key 文件和本期材料 materials.txt 放在同一目录。以下脚本依次提交、等待、下载，重复运行会复用保存在 request.json 中的请求，避免网络中断导致重复生成。修改材料后，先重命名旧 request.json，再运行以创建新任务。

```python
import json, pathlib, time, urllib.request, urllib.error, uuid, re
DISCOVERY = "https://api.github.com/repos/yuruizhang688-cloud/kuailu-ppt-api-docs/contents/connection.json?ref=runtime"
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
opener = urllib.request.build_opener(NoRedirect)
def discover():
    req = urllib.request.Request(DISCOVERY + ("&" if "?" in DISCOVERY else "?") + "_=" + str(time.time_ns()),
        headers={"Accept": "application/vnd.github.raw+json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        base = json.load(r)["base_url"]
    if not re.fullmatch(r"https://[a-z0-9-]+\.trycloudflare\.com", base):
        raise ValueError("连接信息不是有效的服务地址")
    return base
BASE = discover()
key = pathlib.Path("接口Key.txt").read_text(encoding="utf-8").strip()
def call(route, body=None):
    global BASE
    for attempt in range(10):
        try:
            req = urllib.request.Request(BASE + route,
                data=None if body is None else json.dumps(body, ensure_ascii=False).encode(),
                headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
            with opener.open(req, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504, 530):
                raise
        except (urllib.error.URLError, TimeoutError):
            pass
        if attempt == 9:
            raise RuntimeError("暂时无法连接；保留request.json，稍后运行可继续原任务")
        time.sleep(min(30, 2 ** attempt))
        try:
            BASE = discover()
        except (urllib.error.URLError, TimeoutError):
            pass
saved = pathlib.Path("request.json")
if saved.exists():
    request = json.loads(saved.read_text(encoding="utf-8"))
else:
    template = call("/v1/templates")["templates"][0]
    request = {"template_id": template["id"], "template_version": template["version"],
        "idempotency_key": str(uuid.uuid4()),
        "materials": pathlib.Path("materials.txt").read_text(encoding="utf-8")}
    saved.write_text(json.dumps(request, ensure_ascii=False), encoding="utf-8")
job = call("/v1/presentations", request)
print("任务编号：", job["job_id"])
while job["status"] in ("queued", "running", "retry_wait"):
    time.sleep(5)
    job = call("/v1/jobs/" + job["job_id"])
if job["status"] == "succeeded":
    with urllib.request.urlopen(job["pptx_url"], timeout=120) as response:
        pathlib.Path("快鹭周报.pptx").write_bytes(response.read())
    print("全稿预览：", job["preview_url"])
else:
    print(json.dumps(job, ensure_ascii=False, indent=2))
```

## 限制与排错

| HTTP 状态 | 含义 |
|---|---|
| 400 | JSON、字段、计数/比例或内容不符合规则；查看 error.message / error.details |
| 401 | Key 缺失、错误或已被撤销 |
| 403 | 请求 Host / Origin 不在允许范围；使用本文档地址直接调用 |
| 404 | 路径/任务不存在，或任务属于其他 Key |
| 409 | 模板版本已变更，或同一幂等键对应不同内容 |
| 413 / 415 | 请求超过10MiB，或 Content-Type 不是 application/json |
| 429 | 每分钟超过120次请求或待处理任务超过20个；延迟后重试 |
| 502 / 连接失败 | 提供者电脑离线、隧道中断或地址已更换 |

materials 上限150000字符；instructions 上限8000字符；单张词云 data URI 上限2800000字符。完整字段限制以 content_schema 为准。单机任务按顺序运行。服务端运行错误最多尝试10次，退避等待时间为1秒、2秒、4秒、8秒、16秒、10分钟、1小时、6小时、6小时；业务缺项 needs_input 不自动补造。

公开 Markdown：https://yuruizhang688-cloud.github.io/kuailu-ppt-api-docs/docs.md；公开 OpenAPI 3.1：https://yuruizhang688-cloud.github.io/kuailu-ppt-api-docs/openapi.json。以上文档均无需 Key，不包含任何接口 Key 或报告内容。原有 /v1/openapi.json 保留，仍需 Bearer Key。可选 MCP 地址为 {API_BASE}/mcp，普通 API 调用不需要配置 MCP。

本文档独立于提供者电脑。API使用临时HTTPS隧道；后台会自动重连并更新固定连接信息。 提供者电脑需开机、登录macOS并联网；后台运行期间阻止自动空闲睡眠，合盖、手动睡眠、关机和注销仍会中断本机生成。材料模式还需要本机 Codex 登录有效及可用额度。网络恢复与地址更新可能需要数分钟，客户端应按上述方式重试。临时隧道没有可用性保证；需要固定API域名时应切换正式隧道。
