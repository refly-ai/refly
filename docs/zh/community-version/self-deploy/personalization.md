
## 个性化设置介绍

个性化设置功能允许用户接入和使用自己的模型及相关服务，例如大型语言模型 (LLM)、嵌入模型 (EMB)、网页搜索、PDF 解析和 Web 解析。这使用户能够更灵活地使用 Refly，并提高数据安全性。


## 供应商配置
***概念***
“供应商配置”是 Refly 中用于连接和管理外部 AI 服务、模型或数据源（统称为“供应商”）的功能模块。这些供应商为 Refly 提供实现各项高级 AI 功能（如智能搜索、内容生成、数据处理等）所需的能力。通过配置不同的供应商，您可以为 Refly 接入特定的技术引擎或数据资源，从而定制化地增强或启用相关智能服务，确保 Refly 能够根据您的需求高效运行。
![](/images/2025-05-13-16-54-06.png)

### OpenAI 和类 Openai 供应商添加
以下是 OpenAI 和类 OpenAI LLM API 的配置字段说明：

| 字段 (Field)        | 类型 (Type)      | 描述 (Description)                                                                                                                               | 示例/默认值 (Example/Default Value) |
| :------------------ | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------- |
| 类型 (Type)         | 下拉选择 (Dropdown) | 指定配置的外部 AI 服务类型。Refly 支持 OpenAI 及兼容 API 服务（如 Ollama, Jina, Fireworks 等）。正确选择类型有助于 Refly 交互。 | OpenAI                              |
| 名称 (Name)         | 文本输入 (Text Input) | 为此供应商配置指定一个易于识别的名称，用于 Refly 内部引用和区分。                                                               | 例如: 我的 OpenAI                   |
| 类别 (Category)     | 复选框 (Checkboxes) | 定义供应商提供的 AI 能力：LLM (文本生成、对话) 或 嵌入 (文本转向量，用于搜索)。一个供应商可同时提供两种能力。 | LLM, 嵌入                           |
| API Key             | 文本输入 (Text Input) | 访问供应商服务的凭证。请从供应商处获取并填写。请妥善保管，避免泄露。                                                               | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |
| Base URL            | 文本输入 (Text Input) | 指定供应商 API 的网络地址。标准 OpenAI 服务默认为 `https://api.openai.com/v1`。类 OpenAI 或自托管模型需修改。 | `https://api.openai.com/v1`         |
| 是否启用 (Is Enabled) | 开关 (Toggle)    | 控制此供应商配置是否启用。禁用后 Refly 将不使用此配置。                                                                               | 启用 (On)                           |

### 供应商介绍
#### Openroute  (有免费额度)

***概念***

OpenRouter 提供来自不同供应商的多种基础模型，并提供统一的访问接口。它每日提供不同供应商的免费模型额度，为普通用户提供了快速体验模型的途径。

##### 访问openroute
1. 访问 http://openrouter.ai/
![](/images/2025-05-13-17-00-37.png)
2. 选择登录/注册账号
![](/images/2025-05-13-17-01-47.png)
![](/images/2025-05-13-17-02-31.png)
3. 我这里选择使用Google 进行登录(前期有Google账号,在后面使用Gemini模型也会用到)
![](/images/2025-05-13-17-04-02.png)
![](/images/2025-05-13-17-04-54.png)
4. 登录成功确认
![](/images/2025-05-13-17-05-32.png)


##### Apikey 申请
1. 点击用户头像，选择“Keys”。
![](/images/2025-05-13-17-07-48.png)
2. 创建 API Key。
![](/images/2025-05-13-17-08-59.png)
3. 复制生成的 API Key。（重要提示：请妥善保管您的 API 密钥，避免泄露造成财产损失。）
![](/images/2025-05-13-17-11-48.png)
![](/images/2025-05-13-17-12-26.png)
4. 保存此 Key，稍后将在 Refly 中进行配置。

##### 充值
您可以根据个人需求进行充值。充值后可以使用付费模型并提高免费模型的配额（具体详情请查看 OpenRouter 官网）。
1. 进入充值页面
![](/images/2025-05-13-17-15-36.png)
2. 添加信用卡（请注意保护您的支付信息）。
![](/images/2025-05-13-17-16-15.png)
![](/images/2025-05-13-17-17-18.png)
![](/images/2025-05-13-17-18-51.png)
3. 充值
![](/images/2025-05-13-17-22-48.png)
![](/images/2025-05-13-17-24-14.png)

##### Refly 配置方法
1. 填写"名称"
2. 将申请的key粘贴到 API Key 中
3. 勾选 类别,勾选启用, 点击"添加"
![](/images/2025-05-13-16-57-09.png)
#### Google (有免费额度)
***概念***

Google 提供 Gemini 2.5 Pro、Gemini 2.0 Flash 等模型。具体模型列表请查看 [https://ai.google.dev/gemini-api/docs/models?hl=zh-cn](https://ai.google.dev/gemini-api/docs/models?hl=zh-cn)，模型额度请参考 [https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-cn](https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-cn)。对于普通用户而言，免费额度通常已足够使用；如需更高用量，请参考官网套餐进行订阅。
##### 注册或登录Google
1. 访问 Google 主页。（请注意：由于 Google 服务可能受地区限制，请在符合 Google 政策的区域访问，或使用公司提供的专用 VPN。）
2. 在浏览器中选择无痕模式，输入 Google 域名。
![](/images/2025-05-13-17-37-35.png)
3. 注册或创建 Google 账号。
![](/images/2025-05-13-17-38-49.png)
![](/images/2025-05-13-17-39-42.png)
![](/images/2025-05-13-17-41-16.png)
![](/images/2025-05-13-17-41-52.png)
![](/images/2025-05-13-17-42-41.png)
![](/images/2025-05-13-17-43-12.png)
![](/images/2025-05-13-17-43-42.png)
![](/images/2025-05-13-17-44-22.png)
![](/images/2025-05-13-17-44-44.png)
![](/images/2025-05-13-17-45-11.png)
* 大部分情况下需要进行手机验证。
![](/images/2025-05-13-17-47-05.png)
##### 登录Google AI Studio
1. 登录 Google AI Studio：[https://aistudio.google.com/prompts/new_chat](https://aistudio.google.com/prompts/new_chat)
![](/images/2025-05-13-17-49-36.png)
2. 获取 API Key。
![](/images/2025-05-13-17-50-52.png)
或
![](/images/2025-05-13-17-51-59.png)
![](/images/2025-05-13-17-52-26.png)
![](/images/2025-05-13-17-51-29.png)

![](/images/2025-05-13-17-53-06.png)
3. 保存此 Key，稍后将在 Refly 中进行配置。

##### Refly 配置方法
1. Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
2. 其他信息参考图片
![](/images/2025-05-13-17-55-48.png)
#### DeepSeek
##### 注册或登录Deepseek
1. 登录 DeepSeek 管理平台：[https://platform.deepseek.com/](https://platform.deepseek.com/)
2. 注册或登录账号。
![](/images/2025-05-13-18-03-21.png)
![](/images/2025-05-14-08-30-53.png)
3. 创建 API Key。
![](/images/2025-05-14-08-33-06.png)
![](/images/2025-05-14-08-33-30.png)
4. 复制生成的 API Key，以备后续使用。
![](/images/2025-05-14-08-34-26.png)
#### Jina
##### 注册或登录Jina
1. 访问 Jina 官网：[https://jina.ai/](https://jina.ai/)
2. 登录或注册 Jina 账号。
![](/images/2025-05-13-21-43-47.png)
![](/images/2025-05-13-21-44-18.png)
![](/images/2025-05-13-21-45-20.png)
![](/images/2025-05-13-21-46-24.png)
3. 复制您的 Jina API Key。
![](/images/2025-05-13-21-47-18.png)
##### 将Jina 配置到Refly
1. 在供应商添加页面添加jina
![](/images/2025-05-13-21-51-18.png)
2. 添加配置信息。Jina 提供嵌入 (Emb)、重排序和 URL 解析服务，建议根据您的需求在模型配置中进行选择。填写您注册获得的 API Key。
![](/images/2025-05-13-21-53-46.png)
3. 添加完成
![](/images/2025-05-13-21-55-05.png)


#### Ollama
##### 搭建
您可以参考 Ollama 官网的搭建教程。请注意，如果 Ollama 和 Refly 不在同一台主机上，您需要在 Ollama 所在的机器上配置 `OLLAMA_HOST=0.0.0.0:11434` 环境变量。
##### 选择模型
1. 访问 Ollama 官网。
![](/images/2025-05-13-22-01-24.png)
2. 导航至 Models 页面。
![](/images/2025-05-13-22-01-40.png)
![](/images/2025-05-13-22-02-09.png)
3. 选择您需要的模型（LLM 或 EMB）。
![](/images/2025-05-13-22-03-44.png)
![](/images/2025-05-13-22-04-30.png)
##### 运行模型
![](/images/2025-05-13-22-04-54.png)
![](/images/2025-05-13-22-05-36.png)
![](/images/2025-05-13-22-06-24.png)
##### 在Refly中配置Ollama
![](/images/2025-05-13-22-08-06.png)
![](/images/2025-05-13-22-09-17.png)
##### 完成Ollama 添加
![](/images/2025-05-13-22-09-57.png)

#### Serper
***概念***
为 Refly 提供搜索服务支持。
##### 注册或登录serper
1. 访问 Serper 网站：[https://serper.dev/](https://serper.dev/)
2. 登录或注册账号。
![](/images/2025-05-13-22-31-07.png)
![](/images/2025-05-13-22-31-45.png)
![](/images/2025-05-13-22-32-14.png)
3. 生成 API Key。

![](/images/2025-05-13-22-32-49.png)
![](/images/2025-05-13-22-33-20.png)
##### 在Refly 中添加 serper
![](/images/2025-05-13-22-34-43.png)
![](/images/2025-05-13-22-35-30.png)
![](/images/2025-05-13-22-36-21.png)


## 模型配置
***概念***
模型配置页面涉及以下三种模型：
1.  **LLM (大型语言模型)**：用于对话和文本生成。您可以配置来自不同供应商的多个 LLM 模型，并根据业务需求选择使用。
2.  **EMB (嵌入模型)**：负责将文本转换为向量表示，常用于搜索和相似度匹配。通常默认配置一个。
3.  **排序模型**：负责对检索结果进行排序。通常默认配置一个。
### LLM 模型添加
#### Openroute LLM 模型添加
1. 选择对应的模型供应商。
2. 在“模型 ID”中选择对应的模型（OpenRouter 提供大量免费模型）。
![](/images/2025-05-13-18-28-28.png)
3. 填写模型名称（此名称将显示在 Refly 中）。
4. “上下文限制”：模型的最大上下文长度，请参考 OpenRouter 模型信息。
5. “最大输出 Tokens”：请参考 OpenRouter 模型信息。
![](/images/2025-05-13-18-31-35.png)
![](/images/2025-05-13-18-32-06.png)
#### Google Gemini 2.5 PRO 模型添加
1. 选择对应的模型提供商：Google。
2. 填写“模型 ID”。您可以在 [https://ai.google.dev/gemini-api/docs/models?hl=zh-cn](https://ai.google.dev/gemini-api/docs/models?hl=zh-cn) 查看并选择模型，在 [https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-cn](https://ai.google.dev/gemini-api/docs/rate-limits?hl=zh-cn) 查看对应模型的免费额度。
![](/images/2025-05-13-18-40-49.png)
![](/images/2025-05-13-18-41-41.png)
3. 填写模型名称（此名称将显示在 Refly 中）。
4. “上下文限制”：模型的最大上下文长度，例如 1M。
5. “最大输出 Tokens”：例如 1M。
#### 其他供应商 LLM
1.  **基础配置信息**：参考上述 OpenRouter 和 Google 的配置方式，选择供应商，填写模型名称（建议与模型 ID 保持一致）、模型 ID（需在模型服务商平台查看）、上下文限制和最大输出 Tokens（同样参考模型提供商信息）。
2.  **能力选择**：根据模型实际支持的能力进行勾选，例如函数调用、视觉能力（如 Claude 3.7, Gemini 等）、推理能力（如 DeepSeek R1）、上下文缓存等。
### 嵌入模型添加
嵌入模型可以选择提供嵌入能力的供应商提供的模型。特别注意：选择嵌入模型的“维度”需要与重排模型一致。
#### Jina 嵌入模型添加
##### 登录 Jina 网站
1. 访问：[https://jina.ai/api-dashboard/embedding](https://jina.ai/api-dashboard/embedding)
![](/images/2025-05-13-22-58-09.png)
##### 选择模型
1. 选择向量模型。
![](/images/2025-05-13-22-58-59.png)
![](/images/2025-05-13-22-59-28.png)
2. 记录模型名称（例如：jina-embeddings-v3）。
##### Refly配置嵌入模型
1. 参数解释


| 字段 (Field)   | 类型 (Type)      | 描述 (Description)         | 示例/默认值 (Example/Default Value) |
| -------------- | ---------------- | -------------------------- | ---------------------------------- |
| 供应商 (Provider) | 下拉选择 (Dropdown) | 选择提供嵌入模型的供应商。 | Jina                               |
| 模型ID (Model ID) | 文本输入 (Text Input) | 模型的唯一标识符。         | jina-embeddings-v3                 |
| 模型名称 (Model Name) | 文本输入 (Text Input) | 在 Refly 中显示的名称。 | jina-embeddings-v3                 |
| 维度 (Dimension) | 数字输入 (Number Input) | 嵌入向量的维度。           | 1024                               |
| 批量大小 (Batch Size) | 数字输入 (Number Input) | 处理时的批量大小。         | 20                                 |
| 是否启用 (Is Enabled) | 开关 (Toggle)    | 控制模型是否启用。         | 启用 (On)                          |

2.添加Jina 嵌入模型
![](/images/2025-05-13-23-16-34.png)
##### Refly配置排序模型
排序模型可以选择提供排序能力的供应商提供的模型。特别注意：选择排序模型的“维度”需要与嵌入模型一致。


### 重排模型添加
#### Jina 排序模型添加
##### 登录Jina网站
1. 访问：[https://jina.ai/api-dashboard/reranker](https://jina.ai/api-dashboard/reranker)
![](/images/2025-05-13-23-23-51.png)
##### 选择模型
1. 选择排序模型。
![](/images/2025-05-13-23-25-28.png)
![](/images/2025-05-13-23-25-51.png)
2. 记录模型名称（例如：jina-colbert-v2）。
##### Refly配置排序模型
1. 参数解释

| 参数中文名        | 概念解释                                                                                                | 是否必填 (根据图示) | 备注                     |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------ |
| 供应商            | 提供该模型的组织或公司。                                                                                      | 是 (带红色星号\*)   | 通常从预设列表中选择。     |
| 模型ID            | 模型在系统或供应商内部的唯一标识符。                                                                      | 是 (带红色星号\*)   | 通常不可编辑或由选择决定。 |
| 模型名称          | 用户为该模型实例设定的可读名称，方便管理和区分。                                                                     | 是 (带红色星号\*)   | 用户可自定义。             |
| 返回结果数量      | 模型进行查询时返回的最大结果条目数。                                                                                | 否                  | 根据需求设置。             |
| 相关性阈值        | 用于过滤模型结果的相关性得分下限，只有高于此阈值的结果才会被返回。                                                              | 否                  | 根据需求设置。             |
| 是否启用          | 控制该模型配置当前是否生效的开关。                                                                                    | -                   | 开关控件，默认为“开”。     |

2. 添加排序模型
![](/images/2025-05-13-23-34-53.png)
![](/images/2025-05-13-23-35-15.png)


## 解析配置
### 内置解析器
![](/images/2025-05-13-23-37-13.png)
### 配置其他供应商解析器
![](/images/2025-05-13-23-38-18.png)
![](/images/2025-05-13-23-38-37.png)
![](/images/2025-05-13-23-38-56.png)


### 默认解析模型
![](/images/2025-05-13-23-40-29.png)