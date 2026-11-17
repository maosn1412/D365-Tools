using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.Remoting.Contexts;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Text.RegularExpressions;
using Crm.Plugins.Share.Common.Extensions;
using Crm.Plugins.Share.Common;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Newtonsoft.Json;

namespace Crm.Plugins.Share.Common.Extensions
{
    /// <summary>
    /// 组织服务扩展类
    /// </summary>
    public static class OrganizationServiceExtensions
    {
        #region 批量读写，无事务
        /// <summary>
        /// 批量执行
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="creates">需要创建的实体</param>
        /// <param name="updates">需要更新的实体</param>
        public static ExecuteMultipleResponse BatchExecute(this IOrganizationService service, List<Entity> creates, List<Entity> updates)
        {
            if (creates.IsNullOrEmpty() && updates.IsNullOrEmpty()) return null;

            ExecuteMultipleRequest multipleRequest = new ExecuteMultipleRequest()
            {
                Settings = new ExecuteMultipleSettings()
                {
                    ContinueOnError = false,
                    ReturnResponses = false
                },
                Requests = new OrganizationRequestCollection()
            };

            if (creates.IsNotNullOrEmpty())
            {
                multipleRequest.Requests.AddRange(creates.Select(g => new CreateRequest
                {
                    Target = g
                }));
            }

            if (updates.IsNotNullOrEmpty())
            {
                multipleRequest.Requests.AddRange(updates.Select(g => new UpdateRequest
                {
                    Target = g
                }));
            }

            return (ExecuteMultipleResponse)service.Execute(multipleRequest);
        }

        /// <summary>
        /// 批量执行
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="trace">日志记录</param>
        /// <param name="creates">需要创建的实体</param>
        /// <param name="updates">需要更新的实体</param>
        public static void BatchExecute(this IOrganizationService service, ITracingService trace, List<Entity> creates, List<Entity> updates)
        {
            var result = service.BatchExecute(creates, updates);
            if (!result.IsFaulted) return;

            trace.Trace($"response:{JsonConvert.SerializeObject(result)}");
        }

        /// <summary>
        /// 批量创建
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="creates">需要创建的实体</param>
        public static ExecuteMultipleResponse BatchCreate(this IOrganizationService service, List<Entity> creates) =>
            service.BatchExecute(creates, null);

        /// <summary>
        /// 批量创建
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="trace">日志记录</param>
        /// <param name="creates">需要创建的实体</param>
        public static void BatchCreate(this IOrganizationService service, ITracingService trace, List<Entity> creates) =>
            service.BatchExecute(trace, creates, null);

        /// <summary>
        /// 批量更新
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="updates">需要更新的实体</param>
        public static ExecuteMultipleResponse BatchUpdate(this IOrganizationService service, List<Entity> updates) =>
            service.BatchExecute(null, updates);


        /// <summary>
        /// 批量更新
        /// </summary>
        /// <param name="service">组织服务</param>
        /// <param name="trace">日志记录</param>
        /// <param name="updates">需要更新的实体</param>
        public static void BatchUpdate(this IOrganizationService service, ITracingService trace, List<Entity> updates) =>
            service.BatchExecute(trace, null, updates);
        #endregion

        #region 批量操作，有事务

        public static ExecuteTransactionResponse TransactExecute(this IOrganizationService service, List<Entity> creates, List<Entity> updates)
        {
            if (creates.IsNullOrEmpty() && updates.IsNullOrEmpty()) return null;

            var tranRequest = new ExecuteTransactionRequest()
            {
                ReturnResponses = false,
                Requests = new OrganizationRequestCollection()
            };

            if (creates.IsNotNullOrEmpty())
            {
                tranRequest.Requests.AddRange(creates.Select(g => new CreateRequest
                {
                    Target = g
                }));
            }

            if (updates.IsNotNullOrEmpty())
            {
                tranRequest.Requests.AddRange(updates.Select(g => new UpdateRequest
                {
                    Target = g
                }));
            }
            
            return (ExecuteTransactionResponse)service.Execute(tranRequest);
        }

        public static ExecuteTransactionResponse TransactCreate(this IOrganizationService service, List<Entity> creates) => service.TransactExecute(creates, null);
        public static ExecuteTransactionResponse TransactUpdate(this IOrganizationService service, List<Entity> updates) => service.TransactExecute(null, updates);

        #endregion

    }
}
