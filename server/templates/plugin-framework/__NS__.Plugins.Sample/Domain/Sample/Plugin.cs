using System;
using Microsoft.Xrm.Sdk;
using Crm.Plugins.Share.Common;
using Crm.Plugins.Share.Common.CommonEnums;

namespace {{NamespacePrefix}}.Plugins.Sample.Domain.Sample
{
    /// <summary>
    /// {{PublisherPrefix}}_sample 实体示例插件。
    /// 演示标准写法：按消息名分发事件，再按阶段（PreValidation/PreOperation/PostOperation）编写逻辑。
    /// 类上的 MessageCreate/MessageUpdate 特性用于登记注册信息（实体、阶段、模式、筛选字段等）。
    /// </summary>
    [MessageCreate(PrimaryEntityName = "{{PublisherPrefix}}_sample", Mode = MessageMode.Synchronous, Stage = MessageStage.PreOperation)]
    [MessageCreate(PrimaryEntityName = "{{PublisherPrefix}}_sample", Mode = MessageMode.Synchronous, Stage = MessageStage.PostOperation)]
    [MessageUpdate(PrimaryEntityName = "{{PublisherPrefix}}_sample", Mode = MessageMode.Synchronous, Stage = MessageStage.PostOperation, FilteringAttributes = "{{PublisherPrefix}}_name")]
    public class Plugin : PluginBase
    {
        protected override void ExecutePlugin(PluginContext context)
        {
            switch (context.messageName.ToUpper())
            {
                case "CREATE":
                    CreateEvent(context);
                    break;
                case "UPDATE":
                    UpdateEvent(context);
                    break;
                case "DELETE":
                    break;
            }
        }

        private void CreateEvent(PluginContext context)
        {
            if (context.PluginExecutionContext.Stage == (int)ContextStage.PreValidation)
            {
                // 预验证阶段：参数校验
            }

            if (context.PluginExecutionContext.Stage == (int)ContextStage.PreOperation)
            {
                // 执行前阶段：示例 - 名称为空时自动填充
                if (!context.CurrentEntity.Contains("{{PublisherPrefix}}_name"))
                {
                    context.CurrentEntity["{{PublisherPrefix}}_name"] = $"Sample-{DateTime.Now:yyyyMMddHHmmss}";
                }
            }

            if (context.PluginExecutionContext.Stage == (int)ContextStage.PostOperation)
            {
                // 执行后阶段：示例 - 记录日志（可在此调用 SystemUserService 做提权操作）
                context.Trace($"{{PublisherPrefix}}_sample created: {context.CurrentEntity.Id}");
            }
        }

        private void UpdateEvent(PluginContext context)
        {
            if (context.PluginExecutionContext.Stage == (int)ContextStage.PostOperation)
            {
                context.Trace($"{{PublisherPrefix}}_sample updated: {context.CurrentEntity.Id}");
            }
        }
    }
}
