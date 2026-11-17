using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Crm.Plugins.Share.Common.Extensions;

namespace Crm.Plugins.Share.Domain.EnvironmentVariableValue
{
    /// <summary>
    /// 环境变量服务
    /// </summary>
    public class EnvironmentService
    {
        readonly IOrganizationService _sysUserService;
        public EnvironmentService(IOrganizationService sysUserService)
        {
            _sysUserService = sysUserService;
        }

        /// <summary>
        /// 获取环境变量值
        /// </summary>
        /// <param name="key">key</param>
        /// <returns></returns>
        public string Get(string key)
        {
            var result = Get(new List<string> { key });
            if (result != null && result.Count > 0 && result.ContainsKey(key))
            {
                return result[key];
            }
            return string.Empty;
        }

        /// <summary>
        /// 获取多个环境变量
        /// </summary>
        /// <param name="keys">key</param>
        /// <returns></returns>
        public Dictionary<string, string> Get(List<string> keys)
        {
            var result = new Dictionary<string, string>();
            if (keys.IsNullOrEmpty()) return result;

            var cond = string.Empty;
            if (keys.Count == 1)
            {
                cond = $"<condition attribute='schemaname' operator='eq' value='{keys[0]}' />";
            }
            else
            {
                var values = string.Join(" ", keys.Select(g => $"<value>{g}</value>"));
                cond = $@"
                <condition attribute='schemaname' operator='in'>
                  {values}
                </condition>";
            }

            var xml = $@"<fetch xmlns:generator='MarkMpn.SQL4CDS'>
  <entity name='environmentvariablevalue'>
    <attribute name='value' />
    <link-entity name='environmentvariabledefinition' to='environmentvariabledefinitionid' from='environmentvariabledefinitionid' alias='d' link-type='inner'>
      <attribute name='schemaname' />
      <filter>        
          {cond}        
      </filter>
    </link-entity>
    <filter>
      <condition attribute='statecode' operator='eq' value='0' />
    </filter>
  </entity>
</fetch>";
            var response = _sysUserService.RetrieveMultiple(new FetchExpression(xml));
            if (response.Entities.Count == 0) return result;

            foreach (var item in response.Entities)
            {
                var aliase = item.GetAttributeValue<AliasedValue>("d.schemaname");
                if (aliase == null) continue;

                string key = aliase.Value.ToString();
                result.Add(key, item.ToString("value"));
            }

            return result;
        }
    }
}
