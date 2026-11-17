
using Microsoft.Xrm.Sdk;
using System.Collections.Generic;
using System.Linq;
using Crm.Plugins.Share.Common.Extensions;

namespace Crm.Plugins.Share.Common.Extensions
{
    /// <summary>
    /// 实体扩展类
    /// 创建人：Tim
    /// 创建时间：2022、10、19
    /// </summary>
    public static class EntityExtensions
    {
        /// <summary>
        /// 获取实体选项集
        /// </summary>
        /// <param name="entity"></param>
        /// <param name="attributeName"></param>
        /// <returns></returns>
        public static OptionSetValue GetOptionSet(this Entity entity, string attributeName)
        {
            if (entity != null)
            {
                if (entity.Contains(attributeName))
                {
                    return entity.GetAttributeValue<OptionSetValue>(attributeName);
                }
            }
            return null;
        }

        /// <summary>
        /// 获取实体引用
        /// </summary>
        /// <param name="entity"></param>
        /// <param name="attributeName"></param>
        /// <returns></returns>
        public static EntityReference GetEntityReference(this Entity entity, string attributeName)
        {
            if (entity != null)
            {
                if (entity.Contains(attributeName))
                {
                    return entity.GetAttributeValue<EntityReference>(attributeName);
                }
            }
            return null;
        }

        /// <summary>
        /// 实体赋值
        /// </summary>
        /// <param name="entity"></param>
        /// <param name="name"></param>
        /// <param name="other"></param>
        public static void SetValue(this Entity entity, string name, Entity other)
        {
            if (other.IsNotNull(name)) entity[name] = other[name];
        }

        /// <summary>
        /// 从现有实体赋值一个新实体
        /// 仅拷贝自定义字段
        /// </summary>
        /// <param name="entity">实体</param>
        /// <param name="excepts">排除的字段</param>
        public static Entity New(this Entity entity, List<string> excepts = null)
        {
            if (entity == null) return null;
            if (excepts.IsNullOrEmpty())
            {
                excepts = new List<string>();
            }
            excepts.AddRange(new List<string> {
                $"{entity.LogicalName}id",
                "activityid",
            });

            var newEn = new Entity(entity.LogicalName);
            foreach (var item in entity.Attributes)
            {
                if (item.Key.IndexOf("_") <= 0) continue;
                if (excepts.Any(g => g == item.Key)) continue;

                newEn.Attributes.Add(item);
            }

            return newEn;
        }

        /// <summary>
        /// 实体赋值
        /// </summary>
        /// <param name="entity"></param>
        /// <param name="name"></param>
        /// <param name="other"></param>
        /// <param name="otherFilder"></param>
        public static void SetValue(this Entity entity, string name, Entity other, string otherFilder)
        {
            if (other.IsNotNull(otherFilder)) entity[name] = other[otherFilder];
        }

        /// <summary>
        /// 实体赋值
        /// </summary>
        /// <param name="entity"></param>
        /// <param name="name"></param>
        /// <param name="other"></param>
        /// <param name="otherFilder"></param>
        public static void SetValue(this Entity entity, string attributeName, object value)
        {
            entity[attributeName] = value;
        }

        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="entity"></param>
        /// <param name="fieldName"></param>
        /// <returns></returns>
        public static T GetValueByAliasedValue<T>(this Entity entity, string fieldName)
        {
            if (entity == null || !entity.Contains(fieldName)) return default(T);
            if (entity[fieldName] is AliasedValue)
            {
                var aliasedValue = entity.GetAttributeValue<AliasedValue>(fieldName);
                if (aliasedValue == null) return default(T);
                if(aliasedValue.Value==null) return default(T);
                return (T)aliasedValue.Value;
            }
            else
            {
                return default(T);
            }
        }

        /// <summary>
        /// 相对于target指定字段的值是否有变化
        /// </summary>
        /// <param name="entity"></param>
        /// <param name="target"></param>
        /// <param name="fieldName"></param>
        /// <returns></returns>
        public static bool CheckValueIsChanged<T>(this Entity entity, Entity target, string fieldName)
        {
            if (entity.LogicalName != target.LogicalName) return true;
            var entityValue = default(T);
            var targetValue = default(T);
            if (entity.Contains(fieldName)) entityValue = entity.GetAttributeValue<T>(fieldName);
            if (target.Contains(fieldName)) targetValue = target.GetAttributeValue<T>(fieldName);
            return entityValue.IsEqual(targetValue);
        }
    }
}
