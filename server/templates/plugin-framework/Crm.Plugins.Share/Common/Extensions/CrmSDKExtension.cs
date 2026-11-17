/**
 *  Plugin通用类扩展函数库
 */
namespace Crm.Plugins.Share.Common.Extensions
{
    using Microsoft.Xrm.Sdk;
    using System;
    using Microsoft.Xrm.Sdk.Query;
    using System.Text;
    using System.Collections.Generic;
    using System.Xml.Linq;
    using System.Linq;
    using System.Xml;

    public static class CrmSDKExtensionMethod
    {
        #region Common Method

        /// <summary>
        /// 判断对象是否为空
        /// </summary>
        private static bool IsNotNull(object obj)
        {
            return obj != null && obj != DBNull.Value && !string.IsNullOrEmpty(obj.ToString());
        }

        /// <summary>
        /// 判断实体中是否包含属性并且不为空
        /// </summary>
        /// <param name="name">属性名</param>
        public static bool IsNotNull(this Entity en, string name)
        {
            return en != null && en.Contains(name) && IsNotNull(en.GetAttributeValue<object>(name));
        }

        /// <summary>
        /// 判断实体中是否包含Alias属性并且不为空
        /// </summary>
        /// <param name="name">属性名</param>
        public static bool IsAliasValueNotNull(this Entity en, string name)
        {
            return en != null && en.Contains(name) && IsNotNull(((AliasedValue)en[name]).Value);
        }

        /// <summary>
        /// 获取Alias字段的值，如果为空则返回null
        /// </summary>
        /// <param name="name">字段的别名</param>
        /// <returns></returns>
        public static object ToAliasValue(this Entity en, string name)
        {
            return en.IsAliasValueNotNull(name) ? ((AliasedValue)en[name]).Value : null;
        }

        /// <summary>
        /// 获取Alias字段的值，如果为空则返回null
        /// </summary>
        /// <param name="en">实体</param>
        /// <param name="name">字段</param>
        /// <returns></returns>
        public static T ToAlias<T>(this Entity en, string name)
        {
            var alias = en.GetAttributeValue<AliasedValue>(name);
            if (alias == null) return default;

            return (T)alias.Value;
        }

        /// <summary>
        /// 将实体引用转换为实体
        /// </summary>
        public static Entity ToEntity(this EntityReference er)
        {
            return new Entity() { LogicalName = er.LogicalName, Id = er.Id };
        }

        /// <summary>
        /// Entity对象是否为空
        /// </summary>
        /// <param name="er">Entity对象</param>
        /// <returns>若Entity对象不等于null且Entity对象的Id属性不等于Guid.Empty，则返回true，反之则返回false</returns>
        public static bool IsNotNull(this Entity etn)
        {
            return etn != null && etn.Id != Guid.Empty;
        }

        /// <summary>
        /// EntityReference对象是否为空
        /// </summary>
        /// <param name="er">EntityReference对象</param>
        /// <returns>若EntityReference对象不等于null且EntityReference对象的Id属性不等于Guid.Empty，则返回true，反之则返回false</returns>
        public static bool IsNotNull(this EntityReference er)
        {
            return er != null && er.Id != Guid.Empty;
        }

        /// <summary>
        /// EntityCollection集合是否为空
        /// </summary>
        /// <param name="ec">EntityCollection对象</param>
        /// <returns>若EntityCollection对象不等于null且EntityCollection.Entities不等于null且EntityCollection.Entities.Count大于0，则返回true，反之则返回false</returns>
        public static bool IsNotNull(this EntityCollection ec)
        {
            return ec != null && ec.Entities != null && ec.Entities.Count > 0;
        }

        /// <summary>
        /// 复制一个空的实体实例
        /// </summary>
        /// <param name="entity"></param>
        /// <returns></returns>
        public static Entity Copy(this Entity entity)
        {
            return new Entity() { LogicalName = entity.LogicalName, Id = entity.Id };
        }

        /// <summary>
        /// 判断两个字段的值是否相等
        ///     两个字段可以属于同一个实体，也可以属于不同的实体
        /// </summary>
        /// <param name="objSelf"></param>
        /// <param name="objTarget"></param>
        /// <returns></returns>
        public static bool IsEqual(this object objSelf, object objTarget)
        {
            bool blnResult = false;

            if (objSelf == null && objTarget == null) return true;
            if (objSelf == null && objTarget != null) return false;
            if (objSelf != null && objTarget == null) return false;

            Type typeOfSelf = objSelf.GetType();
            Type typeOfTarget = objTarget.GetType();
            if (typeOfSelf != typeOfTarget) throw new InvalidPluginExecutionException($"{typeOfSelf.Name}类型的对象不能与{typeOfTarget.Name}类型的对象比较");

            if (typeOfSelf == typeof(AliasedValue))
            {
                return ((AliasedValue)objSelf).Value.IsEqual(((AliasedValue)objTarget).Value);
            }

            //Guid
            if (typeOfSelf == typeof(Guid))
            {
                Guid selfValue = (Guid)objSelf;
                Guid targetValue = (Guid)objTarget;
                if (selfValue == targetValue) blnResult = true;
            }

            //单行文本、多行文本
            else if (typeOfSelf == typeof(String))
            {
                string selfValue = objSelf.ToString();
                string targetValue = objTarget.ToString();
                if (selfValue == targetValue) blnResult = true;
            }

            //选项集
            else if (typeOfSelf == typeof(OptionSetValue))
            {
                OptionSetValue selfValue = (OptionSetValue)objSelf;
                OptionSetValue targetValue = (OptionSetValue)objTarget;
                if (selfValue.Value == targetValue.Value) blnResult = true;
            }

            //两个选项
            else if (typeOfSelf == typeof(Boolean))
            {
                bool selfValue = (bool)objSelf;
                bool targetValue = (bool)objTarget;
                if (selfValue == targetValue) blnResult = true;
            }

            //整数
            else if (typeOfSelf == typeof(Int16) || typeOfSelf == typeof(Int32) || typeOfSelf == typeof(Int64))
            {
                var selfValue = typeOfSelf == typeof(Int64) ? (Int64)objSelf : (int)objSelf;
                var targetValue = typeOfSelf == typeof(Int64) ? (Int64)objTarget : (int)objTarget;
                if (selfValue == targetValue) blnResult = true;
            }

            //浮点数
            else if (typeOfSelf == typeof(Double))
            {
                double selfValue = (double)objSelf;
                double targetValue = (double)objTarget;
                if (selfValue == targetValue) blnResult = true;
            }

            //十进制数
            else if (typeOfSelf == typeof(Decimal))
            {
                decimal selfValue = (decimal)objSelf;
                decimal targetValue = (decimal)objTarget;
                if (selfValue == targetValue) blnResult = true;
            }

            //货币
            else if (typeOfSelf == typeof(Money))
            {
                Money selfValue = (Money)objSelf;
                Money targetValue = (Money)objTarget;
                if (selfValue.Value == targetValue.Value) blnResult = true;
            }

            //日期时间
            else if (typeOfSelf == typeof(DateTime))
            {
                DateTime selfValue = (DateTime)objSelf;
                DateTime targetValue = (DateTime)objTarget;
                if (selfValue.CompareTo(targetValue) == 0) blnResult = true;
            }

            //日期时间
            else if (typeOfSelf == typeof(DateTime?))
            {
                DateTime? dateSelf = (DateTime?)objSelf;
                DateTime? dateTarget = (DateTime?)objTarget;
                if (!dateSelf.HasValue && !dateTarget.HasValue) return true;
                if (!dateSelf.HasValue && dateTarget.HasValue) return false;
                if (dateSelf.HasValue && !dateTarget.HasValue) return false;

                DateTime selfValue = dateSelf.Value;
                DateTime targetValue = dateTarget.Value;
                if (selfValue.CompareTo(targetValue) == 0) blnResult = true;
            }

            //查找
            else if (typeOfSelf == typeof(EntityReference))
            {
                EntityReference selfValue = (EntityReference)objSelf;
                EntityReference targetValue = (EntityReference)objTarget;
                if (selfValue.LogicalName == targetValue.LogicalName && selfValue.Id == targetValue.Id) blnResult = true;
            }

            return blnResult;
        }
        #endregion Common Method

        #region GetAttributeValue

        /// <summary>
        /// 获取实体下指定的string类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static string ToString(this Entity en, string name, string defaultValue)
        {
            return SetDefaultValue<string>(en, name, defaultValue, obj => { return obj.ToString(); });
        }

        /// <summary>
        /// 获取实体下指定的string类型字段值,无则返回空字符
        /// </summary>
        /// <param name="name">属性值</param>
        public static string ToString(this Entity en, string name)
        {
            return ToString(en, name, string.Empty);
        }

        /// <summary>
        /// 获取实体下指定的string类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static string ToString(this Entity en, Entity en1, string name, string defaultValue)
        {
            return SetDefaultValue<string>(en, en1, name, defaultValue, obj => { return obj.ToString(); });
        }

        /// <summary>
        /// 获取实体下指定的string类型字段值,无则返回空字符
        /// </summary>
        /// <param name="name">属性值</param>
        public static string ToString(this Entity en, Entity en1, string name)
        {
            return ToString(en, en1, name, string.Empty);
        }

        /// <summary>
        /// 获取实体下指定的类型字段值,无则返回null
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static object ToObject<T>(this Entity en, string name)
        {
            if (en.IsNotNull(name))
                return en.GetAttributeValue<T>(name);
            return null;
        }

        /// <summary>
        /// 获取实体下指定的int类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static int ToInt(this Entity en, string name, int defaultValue = 0)
        {
            return SetDefaultValue<int>(en, name, defaultValue, obj => { return Convert.ToInt32(obj); });
        }

        /// <summary>
        /// 获取实体下指定的int类型字段值,无则返回指定默认值
        /// 先获取en中的值，若en不包含该字段，则返回en1中的值
        /// en和en1中都不包含该字段则返回指定defaultValue
        /// </summary>
        /// <param name="en1">备用Entity对象</param>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static int ToInt(this Entity en, Entity en1, string name, int defaultValue = 0)
        {
            return SetDefaultValue<int>(en, en1, name, defaultValue, obj => { return Convert.ToInt32(obj); });
        }

        /// <summary>
        /// 获取实体下指定的int类型字段值,无则返回0
        /// </summary>
        /// <param name="name">字段名</param>
        public static int ToInt(this Entity en, string name)
        {
            return ToInt(en, name, 0);
        }

        /// <summary>
        /// 获取实体下指定的int类型字段值,无则返回0
        /// 先获取en中的值，若en不包含该字段，则返回en1中的值
        /// en和en1中都不包含该字段则返回指定defaultValue
        /// </summary>
        /// <param name="en1">备用Entity对象</param>
        /// <param name="name">字段名</param>
        public static int ToInt(this Entity en, Entity en1, string name)
        {
            return ToInt(en, en1, name, 0);
        }

        /// <summary>
        /// 获取实体下指定的optionSetValue类型字段
        /// </summary>
        /// <param name="name">字段名</param>
        public static OptionSetValue ToOp(this Entity en, string name)
        {
            return SetDefaultValue(en, name, null, obj => { return (OptionSetValue)obj; });
        }

        /// <summary>
        /// 获取实体下指定的optionSetValue类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static int ToOpInt(this Entity en, string name, int defaultValue)
        {
            return SetDefaultValue<int>(en, name, defaultValue, obj => { return ((OptionSetValue)obj).Value; });
        }

        /// <summary>
        /// 获取实体下指定的optionSetValue类型字段值
        /// 先获取en中的值，若en不包含该字段，则返回en1中的值
        /// en和en1中都不包含该字段则返回指定defaultValue
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static int ToOpInt(this Entity en, Entity en1, string name, int defaultValue)
        {
            return SetDefaultValue<int>(en, en1, name, defaultValue, obj => { return ((OptionSetValue)obj).Value; });
        }

        /// <summary>
        /// 获取实体下指定的optionSetValue类型字段值,无则返回-1
        /// </summary>
        /// <param name="name">字段名</param>
        public static int ToOpInt(this Entity en, string name)
        {
            return ToOpInt(en, name, -1);
        }

        /// <summary>
        /// 获取实体下指定的optionSetValue类型字段值
        /// 先获取en中的值，若en不包含该字段，则返回en1中的值
        /// en和en1中都不包含该字段则返回-1
        /// </summary>
        /// <param name="name">字段名</param>
        public static int ToOpInt(this Entity en, Entity en1, string name)
        {
            return ToOpInt(en, en1, name, -1);
        }

        /// <summary>
        /// 获取实体下指定的double类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static double ToDouble(this Entity en, string name, double defaultValue)
        {
            return SetDefaultValue<double>(en, name, defaultValue, obj => { return Convert.ToDouble(obj); });
        }

        /// <summary>
        /// 获取实体下指定的double类型字段值,无则返回0
        /// </summary>
        /// <param name="name">字段名</param>
        public static double ToDouble(this Entity en, string name)
        {
            return ToDouble(en, name, 0);
        }

        /// <summary>
        /// 获取实体下指定的decimal类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static decimal ToDecimal(this Entity en, string name, decimal defaultValue = 0)
        {
            return SetDefaultValue<decimal>(en, name, defaultValue, obj => { return Convert.ToDecimal(obj); });
        }

        /// <summary>
        /// 获取实体下指定的Decimal类型字段值；
        /// 无则获取en1的Decimal类型的值；
        /// 最后无则返回defaultValue
        /// </summary>
        /// <param name="en"></param>
        /// <param name="en1"></param>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        /// <returns></returns>
        public static decimal ToDecimal(this Entity en, Entity en1, string name, decimal defaultValue = 0)
        {
            return SetDefaultValue<decimal>(en, en1, name, defaultValue, obj => { return Convert.ToDecimal(obj); });
        }

        /// <summary>
        /// 获取实体下指定的decimal类型字段值,无则返回0
        /// </summary>
        /// <param name="name">字段名</param>
        public static decimal ToDecimal(this Entity en, string name)
        {
            return ToDecimal(en, name, 0);
        }

        /// <summary>
        /// 获取实体下指定的Decimal类型字段值；
        /// 无则获取en1的Decimal类型的值；
        /// 最后无则返回0
        /// </summary>
        /// <param name="name">字段名</param>
        public static decimal ToDecimal(this Entity en, Entity en1, string name)
        {
            return ToDecimal(en, en1, name, 0);
        }

        /// <summary>
        /// 获取实体下指定的boolean类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static bool ToBool(this Entity en, string name, bool defaultValue)
        {
            return SetDefaultValue<bool>(en, name, defaultValue, obj => { return Convert.ToBoolean(obj); });
        }

        /// <summary>
        /// 获取实体下指定的boolean类型字段值,无则返回false
        /// </summary>
        /// <param name="name">字段名</param>
        public static bool ToBool(this Entity en, string name)
        {
            return ToBool(en, name, false);
        }

        #region 获取日期时间的本地值
        /// <summary>
        /// 获取实体下指定的datetime类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static DateTime ToDateTime(this Entity en, string name, DateTime defaultValue, int? intTimeZoneOffsetMinutes)
        {
            return SetDefaultValue<DateTime>(en, name, defaultValue, obj =>
            {
                DateTime dateUtc = Convert.ToDateTime(obj);
                if (intTimeZoneOffsetMinutes.HasValue) return dateUtc.AddMinutes(intTimeZoneOffsetMinutes.Value);
                return dateUtc.ToLocalTime();
            });
        }

        /// <summary>
        /// 获取实体下指定的datetime类型字段值,无则返回默认最小时间值
        /// </summary>
        /// <param name="name">字段名</param>
        public static DateTime ToDateTime(this Entity en, string name, int? intTimeZoneOffsetMinutes = null)
        {
            return ToDateTime(en, name, DateTime.MinValue, intTimeZoneOffsetMinutes);
        }

        /// <summary>
        /// 获取实体下指定的datetime类型字段值,无则返回指定默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static DateTime ToDateTime(this Entity en, Entity en1, string name, DateTime defaultValue, int? intTimeZoneOffsetMinutes)
        {
            return SetDefaultValue<DateTime>(en, en1, name, defaultValue, obj =>
            {
                DateTime dateUtc = Convert.ToDateTime(obj);
                if (intTimeZoneOffsetMinutes.HasValue) return dateUtc.AddMinutes(intTimeZoneOffsetMinutes.Value);
                return dateUtc.ToLocalTime();
            });
        }

        /// <summary>
        /// 获取实体下指定的datetime类型字段值,无则返回默认最小时间值
        /// </summary>
        /// <param name="name">字段名</param>
        public static DateTime ToDateTime(this Entity en, Entity en1, string name, int? intTimeZoneOffsetMinutes = null)
        {
            return ToDateTime(en, en1, name, DateTime.MinValue, intTimeZoneOffsetMinutes);
        }
        #endregion 获取日期时间的本地值

        #region 获取原始日期时间

        public static DateTime? ToDateTime(this Entity entity, string name)
        {
            return entity.GetAttributeValue<DateTime?>(name);
        }

        public static DateTime ZToDateTime(this Entity en, string name)
        {
            return ZToDateTime(en, name, DateTime.MinValue);
        }
        public static DateTime ZToDateTime(this Entity en, string name, DateTime defaultValue)
        {
            return SetDefaultValue<DateTime>(en, name, defaultValue, obj => { return Convert.ToDateTime(obj); });
        }

        public static DateTime ZToDateTime(this Entity en, Entity en1, string name)
        {
            return ZToDateTime(en, en1, name, DateTime.MinValue);
        }
        public static DateTime ZToDateTime(this Entity en, Entity en1, string name, DateTime defaultValue)
        {
            return SetDefaultValue<DateTime>(en, en1, name, defaultValue, obj => { return Convert.ToDateTime(obj); });
        }
        #endregion 获取原始日期时间

        /// <summary>
        /// 获取实体下指定的datetime类型的"格式化时间字符串"字段值,无则返回空字符串
        /// </summary>
        /// <param name="name">字段名</param>
        public static string ToDateString(this Entity en, string name)
        {
            if (en.IsNotNull(name))
            {
                DateTime date = Convert.ToDateTime(en[name]).ToLocalTime();
                return date.ToString("yyyy/MM/dd");
            }
            return string.Empty;
        }

        /// <summary>
        /// 获取实体下指定的Guid类型字段值,无则返回Guid.Empty
        /// </summary>
        /// <param name="name">字段名</param>
        public static Guid ToGuid(this Entity en, string name)
        {
            return SetDefaultValue<Guid>(en, name, Guid.Empty, obj => { return (Guid)obj; });
        }

        /// <summary>
        /// 获取实体下指定的EntityReference类型字段值,无则返回null
        /// </summary>
        /// <param name="name">字段名</param>
        public static EntityReference ToEr(this Entity en, string name)
        {
            return SetDefaultValue<EntityReference>(en, name, null, obj => { return (EntityReference)obj; });
        }

        /// <summary>
        /// 获取实体下指定的EntityReference类型字段值,无则返回null
        /// </summary>
        /// <param name="name">字段名</param>
        public static Guid? ToErId(this Entity en, string name)
        {
            var er = en.ToEr(name);
            if (er == null) return null;

            return er.Id;
        }

        /// <summary>
        /// 获取实体下指定的EntityReference类型字段值；
        /// 无则获取en1的EntityReference类型的值；
        /// 最后无则返回null
        /// </summary>
        /// <param name="en1">指定实体对象</param>
        /// <param name="name">字段名</param>
        public static EntityReference ToEr(this Entity en, Entity en1, string name)
        {
            return SetDefaultValue<EntityReference>(en, en1, name, null, obj => { return (EntityReference)obj; });
        }


        /// <summary>
        /// 获取实体下指定的EntityReference类型字段值后执行一个无返回值的方法
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="action">无返回值的方法</param>
        public static void ToErData(this Entity en, string name, Action<EntityReference> action)
        {
            EntityReference er = ToEr(en, name);
            if (er != null)
            {
                action(er);
            }
        }

        /// <summary>
        /// 获取实体下指定的Money类型字段值，无则返回一个默认值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static decimal ToMoney(this Entity en, string name, decimal defaultValue)
        {
            return SetDefaultValue<decimal>(en, name, defaultValue, obj => { return ((Money)obj).Value; });
        }

        /// <summary>
        /// 获取实体下指定的Money类型字段值，
        /// 无则获取en1下的指定Money类型的字段值,
        /// 最后无则返回一个默认值
        /// </summary>
        /// <param name="en1">指定实体对象</param>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static decimal ToMoney(this Entity en, Entity en1, string name, decimal defaultValue)
        {
            return SetDefaultValue<decimal>(en, en1, name, defaultValue, obj => { return ((Money)obj).Value; });
        }

        /// <summary>
        /// 获取实体下指定的Money类型字段值，无则返回0
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="defaultValue">默认值</param>
        public static decimal ToMoney(this Entity en, string name)
        {
            return ToMoney(en, name, 0);
        }

        /// <summary>
        /// 获取实体下指定的Money类型字段值，
        /// 无则获取en1下的指定Money类型的字段值,
        /// 最后无则返回0
        /// </summary>
        /// <param name="en1">指定实体对象</param>
        /// <param name="name">字段名</param>
        public static decimal ToMoney(this Entity en, Entity en1, string name)
        {
            return ToMoney(en, en1, name, 0);
        }

        /// <summary>
        /// 获取实体下指定的Money类型字段的double值，无则返回0
        /// </summary>
        /// <param name="name">字段名</param>
        public static double ToMoneyD(this Entity en, string name)
        {
            return (double)ToMoney(en, name, 0);
        }

        /// <summary>
        /// 内部通用取值方法
        /// </summary>
        private static T SetDefaultValue<T>(this Entity en, string name, T t, Func<object, T> action)
        {
            if (en.IsNotNull(name))
            {
                if (en[name].GetType() == typeof(AliasedValue))
                {
                    object objAliasValue = en.ToAliasValue(name);
                    if (objAliasValue != null && typeof(T) == typeof(EntityReference) && objAliasValue.GetType() != typeof(EntityReference))
                    {
                        AliasedValue aliasedValue = (AliasedValue)en[name];
                        return action(new EntityReference(aliasedValue.EntityLogicalName, (Guid)objAliasValue));
                    }
                    else return action(en.ToAliasValue(name));
                }
                return action(en[name]);
            }

            return t;
        }

        /// <summary>
        /// 内部通用取值方法，扩展取值源头
        /// </summary>
        private static T SetDefaultValue<T>(this Entity en, Entity en1, string name, T t, Func<object, T> action)
        {
            if (en.IsNotNull(name))
            {
                if (en[name].GetType() == typeof(AliasedValue))
                {
                    object objAliasValue = en.ToAliasValue(name);
                    if (objAliasValue != null && typeof(T) == typeof(EntityReference) && objAliasValue.GetType() != typeof(EntityReference))
                    {
                        AliasedValue aliasedValue = (AliasedValue)en[name];
                        return action(new EntityReference(aliasedValue.EntityLogicalName, (Guid)objAliasValue));
                    }
                    else return action(en.ToAliasValue(name));
                }
                return action(en[name]);
            }
            else if (en1 != null && en1.IsNotNull(name))
            {
                if (en1[name].GetType() == typeof(AliasedValue))
                {
                    object objAliasValue = en1.ToAliasValue(name);
                    if (objAliasValue != null && typeof(T) == typeof(EntityReference) && objAliasValue.GetType() != typeof(EntityReference))
                    {
                        AliasedValue aliasedValue = (AliasedValue)en1[name];
                        return action(new EntityReference(aliasedValue.EntityLogicalName, (Guid)objAliasValue));
                    }
                    else return action(en1.ToAliasValue(name));
                }
                else return action(en1[name]);
            }

            return t;
        }

        /// <summary>
        /// 获取实体下ManagedProperty类型的字段的值
        /// </summary>
        /// <typeparam name="T">实际的字段类型，如BooleanManagedProperty类型对应的T为bool</typeparam>
        /// <param name="en"></param>
        /// <param name="name"></param>
        /// <returns></returns>
        public static ManagedProperty<T> ToManagedProperty<T>(this Entity en, string name)
        {
            ManagedProperty<T> result = null;

            if (en.IsNotNull(name) || en.IsAliasValueNotNull(name)) result = en.GetAttributeValue<ManagedProperty<T>>(name);

            return result;
        }

        /// <summary>
        /// 获取实体OptionSetValue字段的值
        /// </summary>
        /// <param name="entity">实体</param>
        /// <param name="attr">字段逻辑名称</param>
        /// <returns>返回字段值，不包含则返回null</returns>
        public static OptionSetValue OpValue(this Entity entity, string attr) => entity.GetAttributeValue<OptionSetValue>(attr);

        #endregion GetAttributeValue

        #region SetAttributeValue

        /// <summary>
        /// 为实体不同类型的多个字段赋值
        /// </summary>
        /// <param name="en">Entity对象</param>
        /// <param name="aryFieldValue">字段赋值集合</param>
        public static void AddAttr(this Entity en, FieldValueModel[] aryFieldValue)
        {
            if (aryFieldValue == null || aryFieldValue.Length == 0) return;

            foreach (FieldValueModel fieldValue in aryFieldValue)
            {
                en.AddAttr(fieldValue);
            }
        }

        /// <summary>
        /// 为实体不同类型的单个字段赋值
        /// </summary>
        /// <param name="en">Entity对象</param>
        /// <param name="fieldValue">字段赋值对象</param>
        public static void AddAttr(this Entity en, FieldValueModel fieldValue)
        {
            if (string.IsNullOrEmpty(fieldValue.Name)) return;

            en.AddAttr(fieldValue.Name, fieldValue.Type, fieldValue.Value);
        }

        /// <summary>
        /// 为实体不同类型的单个字段赋值
        /// </summary>
        /// <param name="en">Entity对象</param>
        /// <param name="name">字段逻辑名</param>
        /// <param name="fieldType">CRM字段类型</param>
        /// <param name="objValue">字段的值</param>
        public static void AddAttr(this Entity en, string name, MscrmEntityFieldType fieldType, object objValue)
        {
            if (objValue == null)
            {
                en[name] = null;
                return;
            }

            switch (fieldType)
            {
                case MscrmEntityFieldType.PrimaryKey://主键
                    en.Id = (Guid)objValue;
                    break;
                case MscrmEntityFieldType.SingleText://单行文本
                case MscrmEntityFieldType.MultiText://多行文本
                    if (objValue != null) en.AddAttr(name, objValue.ToString());
                    break;
                case MscrmEntityFieldType.TwoOption://两个选项
                    if (objValue != null) en.AddAttr(name, (bool)objValue);
                    break;
                case MscrmEntityFieldType.OptionSet://选项集
                    if (objValue != null)
                    {
                        if (objValue.GetType().BaseType == typeof(System.Enum)) objValue = (int)objValue;
                        en.AddAttrOp(name, (int)objValue);
                    }
                    break;
                case MscrmEntityFieldType.Integer://整数
                    if (objValue != null) en.AddAttr(name, (int)objValue);
                    break;
                case MscrmEntityFieldType.Double://浮点数
                    if (objValue != null) en.AddAttr(name, (double)objValue);
                    break;
                case MscrmEntityFieldType.Decimal://十进制数
                    if (objValue != null) en.AddAttr(name, (decimal)objValue);
                    break;
                case MscrmEntityFieldType.Currency://货币
                    if (objValue != null) en.AddMoney(name, (decimal)objValue);
                    break;
                case MscrmEntityFieldType.DateTime://日期和时间
                    if (objValue != null)
                    {
                        DateTime dateValue = (DateTime)objValue;
                        en.AddAttr(name, dateValue.ToUniversalTime());
                    }
                    break;
                case MscrmEntityFieldType.EntityReference://查找
                    if (objValue != null) en.AddAttr(name, (EntityReference)objValue);
                    break;
            }
        }

        /// <summary>
        /// 内部通用赋值方法
        /// </summary>
        private static void AddAttr<T1, T2>(this Entity en, string name, T1 value, Func<T1, T2> func)
        {
            if (IsNotNull(value))
            {
                if (func == null)
                {
                    en[name] = value;
                }
                else
                {
                    en[name] = func(value);
                }
            }
            else
            {
                en[name] = null;
            }
        }

        /// <summary>
        /// 实体的指定字段赋予DateTime类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">时间格式的字符串</param>
        public static void AddAttrDate(this Entity en, string name, string value)
        {
            en.AddAttr(name, value, v => { return Convert.ToDateTime(v); });
        }

        /// <summary>
        ///  实体的指定字段赋予String类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">字符串</param>
        public static void AddAttr(this Entity en, string name, string value)
        {
            en.AddAttr(name, value, v => { return v; });
        }

        /// <summary>
        ///  实体的指定字段赋予Boolean类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">boolean类型值</param>
        public static void AddAttr(this Entity en, string name, bool value)
        {
            en.AddAttr(name, value, v => { return v; });
        }

        /// <summary>
        ///  实体的指定字段赋予double类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">double类型值</param>
        public static void AddAttr(this Entity en, string name, double value)
        {
            en.AddAttr(name, value, v => { return v; });
        }

        /// <summary>
        ///  实体的指定字段赋予int类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">int类型值</param>
        public static void AddAttr(this Entity en, string name, int value)
        {
            en.AddAttr(name, value, v => { return v; });
        }

        /// <summary>
        ///  实体的指定字段赋予decimal类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">decimal类型值</param>
        public static void AddAttr(this Entity en, string name, decimal value)
        {
            en.AddAttr(name, value, v => { return (decimal)v; });
        }

        /// <summary>
        ///  实体的指定字段赋予Money类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">double类型值</param>
        public static void AddMoney(this Entity en, string name, double value)
        {
            en.AddAttr(name, value, v => { return new Money((decimal)v); });
        }

        /// <summary>
        ///  实体的指定字段赋予Money类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">decimal类型值</param>
        public static void AddMoney(this Entity en, string name, decimal value)
        {
            en.AddAttr(name, value, v => { return new Money(v); });
        }

        /// <summary>
        ///  实体的指定字段赋予OptionSetValue类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">int类型值</param>
        public static void AddAttrOp(this Entity en, string name, int value)
        {
            if (value >= 0)
            {
                en.AddAttr(name, value, v => { return new OptionSetValue(v); });
            }
            else { en[name] = null; }
        }

        /// <summary>
        ///  实体的指定字段赋予EntityReference类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="id">string类型的id值</param>
        /// <param name="lookName">数据业务名称</param>
        /// <param name="text">数据业务名称</param>
        public static void AddAttr(this Entity en, string name, string id, string lookName, string text)
        {
            en.AddAttr(name, id, v => { return new EntityReference() { Id = new Guid(id), LogicalName = lookName, Name = text }; });
        }

        /// <summary>
        ///  实体的指定字段赋予EntityReference类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="id">Guid类型的id值</param>
        /// <param name="lookName">数据业务名称</param>
        /// <param name="text">显示文本</param>
        public static void AddAttr(this Entity en, string name, Guid id, string lookName, string text)
        {
            en.AddAttr(name, id, v => { return new EntityReference() { Id = id, LogicalName = lookName, Name = text }; });
        }

        /// <summary>
        ///  实体的指定字段赋予DateTime类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">DateTime类型的值</param>
        public static void AddAttr(this Entity en, string name, DateTime value)
        {
            en.AddAttr(name, value, v => { return v; });
        }

        /// <summary>
        ///  实体的指定字段赋予EntityReference类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">EntityReference类型的值</param>
        public static void AddAttr(this Entity en, string name, EntityReference value)
        {
            if (value != null)
            {
                AddAttr(en, name, value.Id, value.LogicalName, value.Name);
            }
            else en[name] = null;
        }

        /// <summary>
        ///  实体的指定字段赋予EntityReference类型的值
        /// </summary>
        /// <param name="name">字段名</param>
        /// <param name="value">Entity类型的值</param>
        public static void AddAttr(this Entity en, string name, Entity value)
        {
            if (value != null && !value.Id.Equals(Guid.Empty))
            {
                AddAttr(en, name, value.Id, value.LogicalName, null);
            }
        }
        #endregion

        #region ServiceExtension

        /// <summary>
        /// 快速查询实体(基于一组键值对条件)
        /// </summary>
        /// <param name="name">实体名</param>
        /// <param name="key">键</param>
        /// <param name="value">值</param>
        /// <param name="cols">查询的列(空则查询全部)</param>
        /// <returns>返回实体集合</returns>
        public static EntityCollection QuickRetrieveMultiple(this IOrganizationService service, string name, string key, object value, params string[] cols)
        {
            return service.QuickRetrieveMultiple(name, new string[] { key }, new object[] { value }, cols);
        }

        /// <summary>
        /// 快速查询实体(基于键值对数组条件)
        /// </summary>
        /// <param name="name">实体名</param>
        /// <param name="keys">键数组</param>
        /// <param name="values">值数组</param>
        /// <param name="cols">查询的列(空则查询全部)</param>
        /// <returns>返回实体集合</returns>
        public static EntityCollection QuickRetrieveMultiple(this IOrganizationService service, string name, string[] keys, object[] values, params string[] cols)
        {
            var objColumn = cols.Length > 0 ? new ColumnSet(cols) : new ColumnSet(true);
            var query = new QueryExpression();
            query.EntityName = name;
            query.ColumnSet = objColumn;
            query.Criteria = new FilterExpression(LogicalOperator.And);

            if (name.ToLower() != "annotation" && name.ToLower() != "team" && name.ToLower() != "usersettings" && name.ToLower() != "entitymap" && name.ToLower() != "attributemap")
            {
                if (name.ToLower() == "systemuser" || name.ToLower() == "businessunit")
                { query.Criteria.AddCondition("isdisabled", ConditionOperator.Equal, 0); }
                else if (name.ToLower() == "documenttemplate")
                { query.Criteria.AddCondition("status", ConditionOperator.Equal, false); }
                else query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            }

            for (var i = 0; i < keys.Length; i++)
            {
                string strCondition_AttrName = keys[i];
                object objCondition_Value = values[i];
                if (objCondition_Value == null) query.Criteria.Conditions.Add(new ConditionExpression(strCondition_AttrName, ConditionOperator.Null));
                else
                {
                    if (objCondition_Value.GetType() == typeof(Array) || objCondition_Value.GetType().BaseType == typeof(Array))
                    {
                        Array aryValue = (Array)objCondition_Value;
                        query.Criteria.Conditions.Add(new ConditionExpression(strCondition_AttrName, ConditionOperator.In, aryValue));
                    }
                    else
                    {
                        query.Criteria.Conditions.Add(new ConditionExpression(strCondition_AttrName, ConditionOperator.Equal, objCondition_Value));
                    }
                }
            }

            return service.RetrieveMultiple(query);
        }

        /// <summary>
        /// 快速查询实体(基于一组键值对条件)
        /// </summary>
        /// <param name="name">实体名</param>
        /// <param name="key">键</param>
        /// <param name="value">值</param>
        /// <param name="cols">查询的列(空则查询全部)</param>
        /// <returns>返回单个实体</returns>
        public static Entity QuickRetrieve(this IOrganizationService service, string name, string key, object value, params string[] cols)
        {
            return service.QuickRetrieve(name, new string[] { key }, new object[] { value }, cols);
        }

        /// <summary>
        /// 快速查询实体(基于键值对数组条件)
        /// </summary>
        /// <param name="name">实体名</param>
        /// <param name="key">键数组</param>
        /// <param name="value">值数组</param>
        /// <param name="cols">查询的列(空则查询全部)</param>
        /// <returns>返回单个实体</returns>
        public static Entity QuickRetrieve(this IOrganizationService service, string name, string[] keys, object[] values, params string[] cols)
        {
            var objColumn = cols.Length > 0 ? new ColumnSet(cols) : new ColumnSet(true);
            var query = new QueryExpression();
            query.EntityName = name;
            query.ColumnSet = objColumn;
            query.TopCount = 1;

            if (name.ToLower() != "annotation" && name.ToLower() != "team" && name.ToLower() != "usersettings" && name.ToLower() != "entitymap" && name.ToLower() != "attributemap")
            {
                if (name.ToLower() == "systemuser" || name.ToLower() == "businessunit")
                { query.Criteria.AddCondition("isdisabled", ConditionOperator.Equal, 0); }
                else if (name.ToLower() == "documenttemplate")
                { query.Criteria.AddCondition("status", ConditionOperator.Equal, false); }
                else query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            }

            for (var i = 0; i < keys.Length; i++)
            {
                string strCondition_AttrName = keys[i];
                object objCondition_Value = values[i];
                if (objCondition_Value == null) query.Criteria.AddCondition(strCondition_AttrName, ConditionOperator.Null);
                else
                {
                    if (objCondition_Value.GetType() == typeof(Array) || objCondition_Value.GetType().BaseType == typeof(Array))
                    {
                        Array aryValue = (Array)objCondition_Value;
                        query.Criteria.AddCondition(strCondition_AttrName, ConditionOperator.In, aryValue);
                    }
                    else
                    {
                        query.Criteria.AddCondition(strCondition_AttrName, ConditionOperator.Equal, objCondition_Value);
                    }
                }
            }
            EntityCollection ecResult = service.RetrieveMultiple(query);

            return ecResult != null && ecResult.Entities.Count > 0 ? ecResult.Entities[0] : null;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="service"></param>
        /// <param name="entityName"></param>
        /// <param name="fileds">字段数组</param>
        /// <param name="key">主键Id</param>
        /// <param name="id">记录ID</param>
        /// <returns></returns>
        public static Entity QuickRetrieveById(this IOrganizationService service, string entityName, string[] fields, string key, Guid id)
        {

            if (string.IsNullOrWhiteSpace(entityName) || fields == null || !fields.Any() || id == Guid.Empty)
            {
                return new Entity();
            }
            StringBuilder builder = new StringBuilder();
            foreach (var item in fields)
            {
                builder.Append($"<attribute name='{item}' />");
            }
            string strFetchXml = $@"
<fetch xmlns:generator='MarkMpn.SQL4CDS'  count='1'>
  <entity name='{entityName}'>
    {builder}
    <filter>
      <condition attribute='{key}' operator='eq' value='{id}' />
    </filter>
  </entity>
</fetch>";

            var result = service.RetrieveMultiple(new FetchExpression(strFetchXml));
            if (result.Entities.Any())
                return result.Entities[0];
            return new Entity(); ;
        }
        public static DataCollection<Entity> QuickRetrieveByIds(this IOrganizationService service, string entityName, string[] fields, string key, List<Guid> ids, int count = 1000)
        {
            if (string.IsNullOrWhiteSpace(entityName) || fields == null || !fields.Any() || ids == null || !ids.Any())
            {
                return null;
            }
            if (ids.Count > 5000)
                return null; //建议分配查询
            StringBuilder fieldbuilder = new StringBuilder();
            StringBuilder keyBuilder = new StringBuilder();
            fields.Distinct().ToList().ForEach(x => fieldbuilder.Append($"<attribute name='{x}' />"));
            ids.Distinct().ToList().ForEach(x => keyBuilder.Append($"<value>{x}</value>"));

            string strFetchXml = $@"
<fetch xmlns:generator='MarkMpn.SQL4CDS'  count='{count}'>
  <entity name='{entityName}'>
    {fieldbuilder}
    <filter>
      <condition attribute='{key}' operator='in'>
       {keyBuilder}
      </condition>
    </filter>
  </entity>
</fetch>";
            var result = service.RetrieveMultiple(new FetchExpression(strFetchXml));

            return result.Entities;

        }
        /// <summary>
        /// 快速查询实体记录数(基于一组键值对条件)
        /// </summary>
        /// <param name="name">实体名</param>
        /// <param name="key">键</param>
        /// <param name="value">值</param>
        /// <param name="cols">查询的列(空则查询全部)</param>
        /// <returns>返回符合条件的记录数</returns>
        public static int GetCount(this IOrganizationService service, string name, string key, object value, bool isStateAvailable = true)
        {
            int intTotalCount = 0;

            string strFetchXml = @"<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false' aggregate='true'>
                                      <entity name='" + name + @"'>
                                        <attribute name='" + name + @"id' aggregate='count' alias='TotalCount' />
                                        <filter type='and'>
                                          @Conditions
                                        </filter>
                                      </entity>
                                    </fetch>";

            StringBuilder sbConditions = new StringBuilder();

            if (isStateAvailable)
            {
                if (name.ToLower() == "systemuser")
                {
                    sbConditions.AppendLine("<condition attribute='isdisabled' operator='eq' value='0' />");
                }
                else if (name.ToLower() == "documenttemplate")
                { sbConditions.AppendLine("<condition attribute='status' operator='eq' value='0' />"); }
                else if (name.ToLower() != "annotation")
                {
                    sbConditions.AppendLine("<condition attribute='statecode' operator='eq' value='0' />");
                }
            }

            if (value == null) sbConditions.AppendLine($"<condition attribute='{key}' operator='null' />");
            else
            {
                if (value.GetType() == typeof(Array) || value.GetType().BaseType == typeof(Array))
                {
                    Array aryValue = (Array)value;
                    sbConditions.AppendLine($"<condition attribute='{key}' operator='in'>");
                    for (int i = 0; i < aryValue.Length; i++)
                    {
                        object objConditionInValue = aryValue.GetValue(i);
                        if (objConditionInValue == null) continue;

                        if (objConditionInValue.GetType() == typeof(string)) objConditionInValue = System.Security.SecurityElement.Escape(objConditionInValue.ToString());
                        sbConditions.AppendLine($"<value>{objConditionInValue}</value>");
                    }
                    sbConditions.AppendLine("</condition>");
                }
                else
                {
                    if (value.GetType() == typeof(string)) value = System.Security.SecurityElement.Escape(value.ToString());
                    sbConditions.AppendLine($"<condition attribute='{key}' operator='eq' value='{value}' />");
                }
            }

            strFetchXml = strFetchXml.Replace("@Conditions", sbConditions.ToString());

            EntityCollection ecResult = service.RetrieveMultiple(new FetchExpression(strFetchXml));
            if (ecResult != null && ecResult.Entities.Count > 0)
            {
                intTotalCount = ecResult.Entities[0].ToInt("TotalCount");
            }

            return intTotalCount;
        }

        /// <summary>
        /// 快速查询实体记录数(基于键值对数组条件)
        /// </summary>
        /// <param name="name">实体名</param>
        /// <param name="keys">键数组</param>
        /// <param name="values">值数组</param>
        /// <param name="cols">查询的列(空则查询全部)</param>
        /// <returns>返回符合条件的记录数</returns>
        public static int GetCount(this IOrganizationService service, string name, string[] keys, object[] values, bool isStateAvailable = true)
        {
            int intTotalCount = 0;

            string strFetchXml = @"<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false' aggregate='true'>
                                      <entity name='" + name + @"'>
                                        <attribute name='" + name + @"id' aggregate='count' alias='TotalCount' />
                                        <filter type='and'>
                                          @Conditions
                                        </filter>
                                      </entity>
                                    </fetch>";

            StringBuilder sbConditions = new StringBuilder();

            if (isStateAvailable)
            {
                if (name.ToLower() == "systemuser")
                {
                    sbConditions.AppendLine("<condition attribute='isdisabled' operator='eq' value='0' />");
                }
                else if (name.ToLower() == "documenttemplate")
                {
                    sbConditions.AppendLine("<condition attribute='status' operator='eq' value='0' />");
                }
                else if (name.ToLower() != "annotation")
                {
                    sbConditions.AppendLine("<condition attribute='statecode' operator='eq' value='0' />");
                }
            }

            for (var i = 0; i < keys.Length; i++)
            {
                string key = keys[i];
                object value = values[i];

                if (value == null) sbConditions.AppendLine($"<condition attribute='{key}' operator='null' />");
                else
                {
                    if (value.GetType() == typeof(Array) || value.GetType().BaseType == typeof(Array))
                    {
                        Array aryValue = (Array)value;
                        sbConditions.AppendLine($"<condition attribute='{key}' operator='in'>");
                        for (int j = 0; j < aryValue.Length; j++)
                        {
                            object objConditionInValue = aryValue.GetValue(j);
                            if (objConditionInValue == null) continue;

                            if (objConditionInValue.GetType() == typeof(string)) objConditionInValue = System.Security.SecurityElement.Escape(objConditionInValue.ToString());
                            sbConditions.AppendLine($"<value>{objConditionInValue}</value>");

                        }
                        sbConditions.AppendLine("</condition>");
                    }
                    else
                    {
                        if (value.GetType() == typeof(string)) value = System.Security.SecurityElement.Escape(value.ToString());
                        sbConditions.AppendLine($"<condition attribute='{key}' operator='eq' value='{value}' />");
                    }
                }
            }

            strFetchXml = strFetchXml.Replace("@Conditions", sbConditions.ToString());

            EntityCollection ecResult = service.RetrieveMultiple(new FetchExpression(strFetchXml));
            if (ecResult != null && ecResult.Entities.Count > 0)
            {
                intTotalCount = ecResult.Entities[0].ToInt("TotalCount");
            }

            return intTotalCount;
        }

        /// <summary>
        /// 快速查询字段的聚合值
        /// </summary>
        /// <typeparam name="T">返回结果的类型，若没有GroupBy,只返回一条记录，则直接使用Entity，若返回多条记录，则使用EntityCollection</typeparam>
        /// <param name="service">组织服务</param>
        /// <param name="name">实体名</param>
        /// <param name="key">查询条件键名</param>
        /// <param name="value">查询条件值</param>
        /// <param name="aggregateCols">需要聚合的字段</param>
        /// <param name="groupbyCols">分组依据字段</param>
        /// <param name="isStateAvailable">查询条件中是否使用状态</param>
        /// <returns>返回符合条件的记录，aggregateCols中指定的字段名称，在返回结果的名称为MscrmAggregateType名称(全小写)+字段名称，如sum_new_amount；groupbyCols中指定的字段在返回结果中不变</returns>
        public static T QuickAggregate<T>(this IOrganizationService service, string name, string key, object value, AggregateAttribute[] aggregateCols, string[] groupbyCols = null, bool isStateAvailable = true)
        {
            return service.QuickAggregate<T>(name, new string[] { key }, new object[] { value }, aggregateCols, groupbyCols, isStateAvailable);
        }

        /// <summary>
        /// 快速查询实体记录数(基于键值对数组条件)
        /// </summary>
        /// <typeparam name="T">返回结果的类型，若没有GroupBy,只返回一条记录，则直接使用Entity，若返回多条记录，则使用EntityCollection</typeparam>
        /// <param name="name">实体名</param>
        /// <param name="keys">查询条件键数组</param>
        /// <param name="values">查询条件值数组</param>
        /// <param name="aggregateCols">需要聚合的字段</param>
        /// <param name="groupbyCols">分组依据字段</param>
        /// <param name="isStateAvailable">查询条件中是否使用状态</param>
        /// <returns>返回符合条件的记录，aggregateCols中指定的字段名称，在返回结果的名称为MscrmAggregateType名称(全小写)+字段名称，如sum_new_amount；groupbyCols中指定的字段在返回结果中不变</returns>
        public static T QuickAggregate<T>(this IOrganizationService service, string name, string[] keys, object[] values, AggregateAttribute[] aggregateCols, string[] groupbyCols = null, bool isStateAvailable = true)
        {
            T result = default(T);
            if (aggregateCols == null) return result;

            string strFetchXml = @"<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false' aggregate='true'>
                                      <entity name='" + name + @"'>
                                        @Aggregates
                                        @GroupBy
                                        <filter type='and'>
                                          @Conditions
                                        </filter>
                                      </entity>
                                    </fetch>";

            #region Aggregates
            StringBuilder sbAggregates = new StringBuilder();
            for (var i = 0; i < aggregateCols.Length; i++)
            {
                AggregateAttribute attribute = aggregateCols[i];
                sbAggregates.AppendLine($"<attribute name='{attribute.Name}' alias='{attribute.AggregateType.ToString()}_{attribute.Name}' aggregate='{attribute.AggregateType.ToString().ToLower()}' />");
            }

            strFetchXml = strFetchXml.Replace("@Aggregates", sbAggregates.ToString());
            #endregion Aggregates

            #region GroupBy
            if (groupbyCols != null && groupbyCols.Length > 0)
            {
                StringBuilder sbGroupBy = new StringBuilder();
                for (var i = 0; i < groupbyCols.Length; i++)
                {
                    sbGroupBy.AppendLine($"<attribute name='{groupbyCols[i]}' alias='{groupbyCols[i]}' groupby='true' />");
                }

                strFetchXml = strFetchXml.Replace("@GroupBy", sbGroupBy.ToString());
            }
            #endregion GroupBy

            #region Conditions
            StringBuilder sbConditions = new StringBuilder();

            if (isStateAvailable)
            {
                if (name.ToLower() == "systemuser")
                {
                    sbConditions.AppendLine("<condition attribute='isdisabled' operator='eq' value='0' />");
                }
                else if (name.ToLower() == "documenttemplate")
                { sbConditions.AppendLine("<condition attribute='status' operator='eq' value='0' />"); }
                else if (name.ToLower() != "annotation")
                {
                    sbConditions.AppendLine("<condition attribute='statecode' operator='eq' value='0' />");
                }
            }

            for (var i = 0; i < keys.Length; i++)
            {
                string key = keys[i];
                object value = values[i];

                if (value == null) sbConditions.AppendLine($"<condition attribute='{key}' operator='null' />");
                else
                {
                    if (value.GetType() == typeof(Array) || value.GetType().BaseType == typeof(Array))
                    {
                        Array aryValue = (Array)value;
                        sbConditions.AppendLine($"<condition attribute='{key}' operator='in'>");
                        for (int j = 0; j < aryValue.Length; j++)
                        {
                            object objConditionInValue = aryValue.GetValue(j);
                            if (objConditionInValue == null) continue;

                            if (objConditionInValue.GetType() == typeof(string)) objConditionInValue = System.Security.SecurityElement.Escape(objConditionInValue.ToString());
                            sbConditions.AppendLine($"<value>{objConditionInValue}</value>");
                        }
                        sbConditions.AppendLine("</condition>");
                    }
                    else
                    {
                        if (value.GetType() == typeof(string)) value = System.Security.SecurityElement.Escape(value.ToString());
                        sbConditions.AppendLine($"<condition attribute='{key}' operator='eq' value='{value}' />");
                    }
                }
            }

            strFetchXml = strFetchXml.Replace("@Conditions", sbConditions.ToString());
            #endregion Conditions

            EntityCollection ecResult = service.RetrieveMultiple(new FetchExpression(strFetchXml));
            if (ecResult != null && ecResult.Entities.Count > 0)
            {
                //throw new InvalidPluginExecutionException($"{ecResult.Entities[0].ToDecimal("Sum_new_quantity")}----{strFetchXml}");
                if (typeof(T) == typeof(Entity))
                {
                    result = FormatToCrmValue<T>(ecResult.Entities[0]);
                }
                if (typeof(T) == typeof(EntityCollection))
                {
                    result = FormatToCrmValue<T>(ecResult);
                }
            }
            return result;
        }

        #endregion ServiceExtension

        #region ContextExtension

        /// <summary>
        /// 获取当前顶级上下文对象
        /// </summary>
        public static IPluginExecutionContext GetTopContext(this IPluginExecutionContext context)
        {
            IPluginExecutionContext topContext = context;
            while (topContext != null && topContext.ParentContext != null)
            {
                topContext = topContext.ParentContext;
            }
            return topContext;
        }

        /// <summary>
        /// 设置共享变量
        /// </summary>
        /// <param name="context"></param>
        /// <param name="key"></param>
        /// <param name="value"></param>
        public static void SetSharedVariables(this IPluginExecutionContext context, string key, object value)
        {
            if (context.SharedVariables.Contains(key)) context.SharedVariables.Remove(key);
            context.SharedVariables.Add(key, value);
        }

        /// <summary>
        /// 获取共享变量的值
        /// </summary>
        /// <param name="key">键</param>
        /// <returns>返回键对应的值</returns>
        public static object GetSharedVariables(this IPluginExecutionContext context, string key)
        {
            if (context.SharedVariables != null && context.SharedVariables.Contains(key))
                return context.SharedVariables[key];

            object objValue = null;
            IPluginExecutionContext topContext = context;

            while (topContext != null && topContext.ParentContext != null)
            {
                topContext = topContext.ParentContext;

                if (topContext.SharedVariables != null && topContext.SharedVariables.Contains(key))
                    objValue = topContext.SharedVariables[key];

                if (objValue != null) break;
            }
            return objValue;
        }

        /// <summary>
        /// 获取共享变量的值
        /// </summary>
        /// <typeparam name="T">返回的共享变量值的类型</typeparam>
        /// <param name="context">插件上下文</param>
        /// <param name="key">共享变量key</param>
        /// <param name="defaultValue">当共享变量为null时的默认返回值</param>
        /// <returns>返回键对应的值</returns>
        public static T GetSharedVariables<T>(this IPluginExecutionContext context, string key, T defaultValue = default(T))
        {
            object objValue = GetSharedVariables(context, key);
            return objValue.FormatToCrmValue<T>(defaultValue);
        }

        #endregion ContextExtension

        #region ParameterCollection Extension
        /// <summary>
        /// ParameterCollection中指定key是否有值
        /// </summary>
        /// <param name="parameters"></param>
        /// <param name="key"></param>
        /// <returns></returns>
        public static bool IsNotNull(this ParameterCollection parameters, string key)
        {
            return parameters != null && parameters.Contains(key) && IsNotNull(parameters[key]);
        }

        /// <summary>
        /// 获取ParameterCollection中指定key的值
        /// </summary>
        /// <typeparam name="T">返回值的类型</typeparam>
        /// <param name="parameters">ParameterCollection对象实例</param>
        /// <param name="key">ParameterCollection中的key名称</param>
        /// <param name="defaultValue">返回值为null时的默认值</param>
        /// <returns></returns>
        public static T GetValue<T>(this ParameterCollection parameters, string key, T defaultValue = default(T))
        {
            T result = defaultValue;

            if (parameters.IsNotNull(key))
            {
                object objValue = parameters[key];
                result = objValue.FormatToCrmValue<T>(defaultValue);
            }

            return result;
        }

        /// <summary>
        /// 获取ParameterCollection中选项集类型（OptionSetValue）元素的值
        /// </summary>
        /// <param name="parameters">ParameterCollection对象实例</param>
        /// <param name="key">ParameterCollection中的key名称</param>
        /// <returns>ParameterCollection对象为null时返回-1</returns>
        public static int GetOpIntValue(this ParameterCollection parameters, string key)
        {
            return parameters.GetValue<int>(key, -1);
        }

        /// <summary>
        /// 获取ParameterCollection中字符串类型（string）元素的值
        /// </summary>
        /// <param name="parameters">ParameterCollection对象实例</param>
        /// <param name="key">ParameterCollection中的key名称</param>
        /// <returns>ParameterCollection对象为null时返回string.Empty</returns>
        public static string GetStringValue(this ParameterCollection parameters, string key)
        {
            return parameters.GetValue<string>(key, string.Empty);
        }
        #endregion ParameterCollection Extension

        #region Format Crm Object
        /// <summary>
        /// 获取Crm对象的值
        /// </summary>
        /// <typeparam name="T">返回的对象类型</typeparam>
        /// <param name="obj">对象实例</param>
        /// <param name="defaultValue">对象为空时返回的默认值</param>
        /// <returns></returns>
        public static T FormatToCrmValue<T>(this object obj, T defaultValue = default(T))
        {
            T value = defaultValue;

            //单行文本、多行文本
            if (typeof(T) == typeof(string))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //选项集
            else if (typeof(T) == typeof(OptionSetValue))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //两个选项
            else if (typeof(T) == typeof(bool))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //整数
            else if (typeof(T) == typeof(int))
            {
                if (IsNotNull(obj))
                {
                    Type typeOfObj = obj.GetType();
                    if (typeOfObj == typeof(OptionSetValue)) value = (T)Convert.ChangeType(((OptionSetValue)obj).Value, typeof(T));
                    else value = (T)obj;
                }
            }

            //浮点数
            else if (typeof(T) == typeof(double))
            {
                if (IsNotNull(obj))
                {
                    Type typeOfObj = obj.GetType();
                    if (typeOfObj == typeof(Money)) value = (T)Convert.ChangeType(((Money)obj).Value, typeof(T));
                    else value = (T)obj;
                }
            }

            //十进制数
            else if (typeof(T) == typeof(decimal))
            {
                if (IsNotNull(obj))
                {
                    Type typeOfObj = obj.GetType();
                    if (typeOfObj == typeof(Money)) value = (T)Convert.ChangeType(((Money)obj).Value, typeof(T));
                    else value = (T)obj;
                }
            }

            //货币
            else if (typeof(T) == typeof(Money))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //日期时间
            else if (typeof(T) == typeof(DateTime))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //查找、实体、实体集合
            else if (typeof(T) == typeof(EntityReference) || typeof(T) == typeof(Entity) || typeof(T) == typeof(EntityCollection))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //Guid
            else if (typeof(T) == typeof(Guid))
            {
                if (IsNotNull(obj))
                {
                    Type typeOfObj = obj.GetType();
                    if (typeOfObj == typeof(EntityReference)) value = (T)Convert.ChangeType(((EntityReference)obj).Id, typeof(T));
                    else if (typeOfObj == typeof(Entity)) value = (T)Convert.ChangeType(((Entity)obj).Id, typeof(T));
                    else value = (T)obj;
                }
            }

            //QueryBase类型
            else if (typeof(T) == typeof(QueryBase))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //QueryExpression类型
            else if (typeof(T) == typeof(QueryExpression))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }

            //QueryByAttribute类型
            else if (typeof(T) == typeof(QueryByAttribute))
            {
                if (IsNotNull(obj)) value = (T)obj;
            }
            else
            {

                if (IsNotNull(obj)) value = (T)obj;
            }

            return value;
        }

        /// <summary>
        /// 获取包含字段串对象的值
        /// </summary>
        /// <param name="obj">对象实例</param>
        /// <returns>返回对象实例的值，当对象为null时，返回string.Empty</returns>
        public static string FormatToCrmString(this object obj, string defaultValue = "")
        {
            return obj.FormatToCrmValue<string>(defaultValue);
        }

        /// <summary>
        /// 获取选项集的Int值
        /// </summary>
        /// <param name="obj">对象实例</param>
        /// <returns>返回选项集对象实例的值，当对象为null时，返回-1</returns>
        public static int FormatToCrmOpInt(this object obj)
        {
            return obj.FormatToCrmValue<int>(-1);
        }
        #endregion Format Crm Object

        #region FormattedValueCollection Extension
        /// <summary>
        /// 获取FormattedValueCollection中的值
        /// </summary>
        /// <param name="keyValues">FormattedValueCollection对象</param>
        /// <param name="strKeyName">键名</param>
        /// <param name="defaultValue">键名对应的值为空时使用的默认值</param>
        /// <returns></returns>
        public static string GetText(this FormattedValueCollection keyValues, string strKeyName, string defaultValue = null)
        {
            string strResult = defaultValue;
            if (keyValues.Contains(strKeyName)) strResult = keyValues[strKeyName];

            return strResult;
        }
        #endregion FormattedValueCollection Extension

        #region RetrieveMultipleAll
        /// <summary>
        /// 返回实体的所有记录（自动进行分页循环读取）
        /// </summary>
        /// <remarks>
        /// 若数据量较大，在Plug-in中慎用
        /// </remarks>
        /// <param name="organizationService">组织服务</param>
        /// <param name="query">支持QueryExpression;支持QueryByAttribute;支持FetchExpression</param>
        /// <returns></returns>
        public static EntityCollection RetrieveMultipleAll(this IOrganizationService organizationService, QueryBase query)
        {
            List<Entity> allEntities = new List<Entity>();
            string pagingCookie = null;
            int pageNumber = 1;
            int pageSize = 5000;
            int? recordLimit = null;

            if (query is FetchExpression fe)
            {
                // 移除Top避免冲突
                var (modifiedFetchXml, topValue) = RemoveTopFromFetchXml(fe.Query);
                if (topValue.HasValue)
                {
                    recordLimit = topValue;
                    query = new FetchExpression(modifiedFetchXml);
                }
            }
            else if (query is QueryExpression qe && qe.TopCount.HasValue)
            {
                recordLimit = qe.TopCount;
                // 移除TopCount避免冲突
                qe.TopCount = null;
            }
            else if (query is QueryByAttribute qba && qba.TopCount.HasValue)
            {
                recordLimit = qba.TopCount;
                // 移除TopCount避免冲突
                qba.TopCount = null;
            }

            bool moreRecords;
            do
            {
                QueryBase queryToExecute = query;
                int currentPageSize = pageSize;

                // 如果存在记录限制，调整当前页大小
                if (recordLimit.HasValue)
                {
                    int remaining = recordLimit.Value - allEntities.Count;
                    if (remaining <= 0) break; // 已达限制，停止查询
                    currentPageSize = Math.Min(remaining, pageSize);
                }

                if (queryToExecute is FetchExpression fetchExpression)
                {
                    var fetchXml = fetchExpression.Query;
                    fetchXml = UpdateFetchXmlPaging(fetchXml, pagingCookie, pageNumber, currentPageSize);
                    queryToExecute = new FetchExpression(fetchXml);
                }
                else if (queryToExecute is QueryExpression queryExpression)
                {
                    if (queryExpression.PageInfo == null) queryExpression.PageInfo = new PagingInfo();
                    queryExpression.PageInfo.PagingCookie = pagingCookie;
                    queryExpression.PageInfo.PageNumber = pageNumber;
                    queryExpression.PageInfo.Count = currentPageSize;
                }
                else if (queryToExecute is QueryByAttribute queryByAttribute)
                {
                    if (queryByAttribute.PageInfo == null) queryByAttribute.PageInfo = new PagingInfo();
                    queryByAttribute.PageInfo.PagingCookie = pagingCookie;
                    queryByAttribute.PageInfo.PageNumber = pageNumber;
                    queryByAttribute.PageInfo.Count = currentPageSize;
                }

                EntityCollection result = organizationService.RetrieveMultiple(queryToExecute);
                if (result.Entities.Any()) allEntities.AddRange(result.Entities);

                moreRecords = result.MoreRecords;
                pagingCookie = result.PagingCookie;
                pageNumber++;

                // 如果存在记录限制且已达到，停止循环
                if (recordLimit.HasValue && allEntities.Count >= recordLimit.Value)
                {
                    moreRecords = false;
                }

            } while (moreRecords);

            return new EntityCollection(allEntities)
            {
                PagingCookie = pagingCookie,
                TotalRecordCount = allEntities.Count
            };
        }

        /// <summary>
        /// 从FetchXML中移除top属性并返回其值
        /// </summary>
        /// <param name="fetchXml">Fetch查询XML</param>
        /// <returns>修改后的FetchXML和top值（如果有）</returns>
        private static (string modifiedFetchXml, int? topValue) RemoveTopFromFetchXml(string fetchXml)
        {
            var doc = new XmlDocument();
            doc.LoadXml(fetchXml);
            var fetchNode = doc.SelectSingleNode("//fetch");
            int? topValue = null;

            if (fetchNode?.Attributes?["top"] != null)
            {
                // 获取top值
                if (int.TryParse(fetchNode.Attributes["top"].Value, out int top))
                {
                    topValue = top;
                }

                // 移除top属性
                fetchNode.Attributes.RemoveNamedItem("top");
            }

            return (doc.OuterXml, topValue);
        }

        /// <summary>
        /// 更新Fetch查询XML的分页信息
        /// </summary>
        /// <param name="fetchXml">Fetch查询XML</param>
        /// <param name="pagingCookie">分页Cookie</param>
        /// <param name="pageNumber">页码</param>
        /// <param name="pageSize">分页数</param>
        /// <returns></returns>
        private static string UpdateFetchXmlPaging(string fetchXml, string pagingCookie, int pageNumber, int pageSize)
        {
            var doc = new XmlDocument();
            doc.LoadXml(fetchXml);
            var fetchNode = doc.SelectSingleNode("//fetch");
            if (fetchNode != null)
            {
                // 更新或添加 paging-cookie、page 和 count 属性
                SetOrUpdateAttribute(fetchNode, "paging-cookie", pagingCookie);
                SetOrUpdateAttribute(fetchNode, "page", pageNumber.ToString());
                SetOrUpdateAttribute(fetchNode, "count", pageSize.ToString());
            }

            return doc.OuterXml;
        }

        /// <summary>
        /// 判断属性是否存在，如果不存在则创建，并设置属性的值
        /// </summary>
        /// <param name="node">XML节点</param>
        /// <param name="attributeName">属性名称</param>
        /// <param name="value">属性值</param>
        private static void SetOrUpdateAttribute(XmlNode node, string attributeName, string value)
        {
            var attribute = node.Attributes[attributeName];

            // 如果属性不存在，则创建
            if (attribute == null)
            {
                attribute = node.OwnerDocument.CreateAttribute(attributeName);
                node.Attributes.Append(attribute);
            }

            // 设置属性的值
            attribute.Value = value;
        }
        #endregion
    }

    #region Models & Enums

    /// <summary>
    /// MSCRM实体的字段类型
    /// </summary>
    public enum MscrmEntityFieldType
    {
        /// <summary>
        /// 无效的项目
        /// </summary>
        InvalidItem = -1,
        /// <summary>
        /// 主键
        /// </summary>
        PrimaryKey = 5,
        /// <summary>
        /// 单行文本
        /// </summary>
        SingleText = 10,
        /// <summary>
        /// 选项集
        /// </summary>
        OptionSet = 20,
        /// <summary>
        /// 两个选项
        /// </summary>
        TwoOption = 30,
        /// <summary>
        /// 图像
        /// </summary>
        Image = 40,
        /// <summary>
        /// 整数
        /// </summary>
        Integer = 50,
        /// <summary>
        /// 浮点数
        /// </summary>
        Double = 60,
        /// <summary>
        /// 十进制数
        /// </summary>
        Decimal = 70,
        /// <summary>
        /// 货币
        /// </summary>
        Currency = 80,
        /// <summary>
        /// 多行文本
        /// </summary>
        MultiText = 90,
        /// <summary>
        /// 日期和时间
        /// </summary>
        DateTime = 100,
        /// <summary>
        /// 查找
        /// </summary>
        EntityReference = 110,
        /// <summary>
        /// 客户
        /// </summary>
        Customer = 120
    }

    /// <summary>
    /// 聚合运算符类型
    /// </summary>
    public enum MscrmAggregateType
    {
        /// <summary>
        /// 总和
        /// </summary>
        Sum = 10,
        /// <summary>
        /// 计数
        /// </summary>
        Count = 20,
        /// <summary>
        /// 最大值
        /// </summary>
        Max = 30,
        /// <summary>
        /// 最小值
        /// </summary>
        Min = 40,
        /// <summary>
        /// 平均数
        /// </summary>
        Avg = 50
    }

    /// <summary>
    /// 字段赋值Model
    /// </summary>
    public class FieldValueModel
    {
        public FieldValueModel() { }

        /// <summary>
        /// 带参数实例化
        /// </summary>
        /// <param name="entityLogicalName">实体逻辑名</param>
        /// <param name="name">字段逻辑名</param>
        /// <param name="type">字段类型</param>
        /// <param name="value">字段的值</param>
        public FieldValueModel(string entityLogicalName, string name, MscrmEntityFieldType type, object value)
        {
            EntityLogicalName = entityLogicalName;
            Name = name;
            Type = type;
            Value = value;
        }
        /// <summary>
        /// 实体逻辑名
        /// </summary>
        public string EntityLogicalName { get; set; }

        /// <summary>
        /// 字段逻辑名
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// 字段类型
        /// </summary>
        public MscrmEntityFieldType Type { get; set; }

        /// <summary>
        /// 字段的值
        /// </summary>
        public object Value { get; set; }
    }

    /// <summary>
    /// 聚合运算字段
    /// </summary>
    public class AggregateAttribute
    {
        public AggregateAttribute(string name, MscrmAggregateType aggregateType)
        {
            Name = name;
            AggregateType = aggregateType;
        }
        /// <summary>
        /// 字段名称
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// 聚合运算类型
        /// </summary>
        public MscrmAggregateType AggregateType { get; set; }
    }

    #endregion Models & Enums
}
