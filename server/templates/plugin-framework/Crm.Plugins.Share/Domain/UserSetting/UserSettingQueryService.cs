using Crm.Plugins.Share.Common;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System; 
using System.Linq; 

namespace Crm.Plugins.Share.Domain.UserSetting
{
    /// <summary>
    /// 查询用户设置
    /// </summary>
    public class UserSettingQueryService
    {
        /// <summary>
        /// 根据Key获取多语言
        /// </summary>
        /// <param name="organizationService"></param>
        /// <param name="lcid"></param>
        /// <param name="languageKey"></param>
        /// <returns></returns>
        public int GetUserLCID(IOrganizationService organizationService, Guid systemUserId)
        {
            QueryExpression query = new QueryExpression("usersettings");
            query.NoLock = true;
            query.Distinct = false;
            query.ColumnSet = new ColumnSet("systemuserid", "uilanguageid");
            query.Criteria.AddCondition("systemuserid", ConditionOperator.Equal, systemUserId);
            EntityCollection ec = organizationService.RetrieveMultiple(query);
            if (ec.Entities.Count > 0)
            {
                return ec.Entities.FirstOrDefault().GetAttributeValue<int>("uilanguageid");
            }
            return 2052;
        }

        /// <summary>
        /// 根据Key获取多语言
        /// </summary>
        /// <param name="organizationService"></param>
        /// <param name="lcid"></param>
        /// <param name="languageKey"></param>
        /// <returns></returns>
        public int GetUserLCID(PluginContext context, Guid systemUserId)
        {
            QueryExpression query = new QueryExpression("usersettings");
            query.NoLock = true;
            query.Distinct = false;
            query.ColumnSet = new ColumnSet("systemuserid", "uilanguageid");
            query.Criteria.AddCondition("systemuserid", ConditionOperator.Equal, systemUserId);
            EntityCollection ec = context.SystemUserService.RetrieveMultiple(query);
            if (ec.Entities.Count > 0)
            {
                var lcid = ec.Entities.FirstOrDefault().GetAttributeValue<int>("uilanguageid");
                if (lcid != 0)
                {
                    return lcid;
                }
            } 
            return 1033;
        }
    }
}
