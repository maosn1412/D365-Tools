using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk;
using System;
using System.Collections.Generic;
using System.Text;
using Crm.Plugins.Share.Common;

namespace Crm.Plugins.Share.Common.Extensions
{
    public static class DecimalExtensions
    {
        public static Guid guid_rmb = Guid.Empty;

        /// <summary>
        /// 获取币种为人民币的实体guid
        /// </summary>
        /// <param name="context">执行上下文</param>
        /// <returns>主键id</returns>
        public static Guid? GetEntityRMBGuid(PluginContext context)
        {
            if (guid_rmb == Guid.Empty)
            {
                string str_currencyname = "人民币";
                var str_xml = string.Format(@"<fetch top='1' no-lock='true'>
                                              <entity name='transactioncurrency'>
                                                <attribute name='transactioncurrencyid' />
                                                <filter>
                                                  <condition attribute='currencyname' operator='eq' value='{0}' />
                                                  <condition attribute='statecode' operator='eq' value='0' />
                                                </filter>
                                              </entity>
                                            </fetch>", str_currencyname);
                var result = context.SystemUserService.RetrieveMultiple(new FetchExpression(str_xml));
                if (result.Entities.Count > 0)
                {
                    guid_rmb = result.Entities[0].Id;
                }
                else
                {
                    context.Trace("未找到currencyname=人民币 的币种数据");
                }
            }
            return guid_rmb;
        }

        public static Guid? GetByCode(PluginContext context, string code)
        {
            var str_xml = string.Format(@"<fetch top='1' no-lock='true'>
                                              <entity name='transactioncurrency'>
                                                <attribute name='transactioncurrencyid' />
                                                <filter>
                                                  <condition attribute='isocurrencycode' operator='eq' value='{0}' />
                                                  <condition attribute='statecode' operator='eq' value='0' />
                                                </filter>
                                              </entity>
                                            </fetch>", code);
            var result = context.SystemUserService.RetrieveMultiple(new FetchExpression(str_xml));
            if (result.Entities.Count == 0)
            {
                context.Trace($"未找到code为{code}的币种数据");
            }

            return result.Entities[0].Id;
        }

        /// <summary>
        /// 转为本位币
        /// </summary>
        /// <param name="dcm_value">原币种金额</param>
        /// <param name="context"></param>
        /// <param name="sourceCode">原币种code</param>
        /// <param name="year">年</param>
        /// <param name="month">月</param>
        /// <returns></returns>
        public static decimal? GetBaseCurrency(this decimal dcm_value, PluginContext context, string sourceCode, int year, int month)
        {
            var id = GetByCode(context, sourceCode);
            if (id == null) return null;

            return GetBaseCurrency(dcm_value, context, id.Value, year, month);
        }


        /// <summary>
        /// 获取本币位值
        /// </summary>
        /// <param name="dcm_value">原币值</param>
        /// <param name="context">执行上下文</param>
        /// <param name="guid_transactioncurrencyId">原币币种</param>
        /// <param name="year">年</param>
        /// <param name="month">月</param>
        /// <returns>本币位值</returns>
        /// <exception cref="InvalidPluginExecutionException"></exception>
        public static decimal? GetBaseCurrency(this decimal dcm_value, PluginContext context, Guid guid_transactioncurrencyId, int year, int month)
        {
            // 如果【币种】=人民币 直接返回原币值
            var guid_rmb = GetEntityRMBGuid(context);
            if (guid_transactioncurrencyId == guid_rmb)
            {
                return dcm_value;
            }
            string str_fetchXml = string.Format(@"<fetch top='1' no-lock='true'>
                                              <entity name='apv_exchangerate'>
                                                <attribute name='apv_exchangerate' />
                                                <filter>
                                                  <condition attribute='apv_year' operator='eq' value='{0}' />
                                                  <condition attribute='apv_month' operator='eq' value='{1}' />
                                                  <condition attribute='apv_transactioncurrency_r1' operator='eq' value='{2}' />
                                                  <condition attribute='apv_transactioncurrency_r2' operator='eq' value='{3}' />
                                                </filter>
                                              </entity>
                                            </fetch>", year, month, guid_transactioncurrencyId, guid_rmb);
            var result = context.SystemUserService.RetrieveMultiple(new FetchExpression(str_fetchXml));

            if (result.Entities.Count > 0)
            {
                var dcm_exchangerate = result.Entities[0].GetAttributeValue<decimal>("apv_exchangerate");
                return dcm_value * dcm_exchangerate;
            }
            else
            {
                context.Trace(string.Format("未设置年{0}月{1}原币{2}到人民币的汇率", year, month, guid_transactioncurrencyId));
                throw new InvalidPluginExecutionException(string.Format("未设置年{0}月{1}原币{2}到人民币的汇率", year, month, guid_transactioncurrencyId));
            }
        }

        /// <summary>
        /// 根据原币种获取目标币种金额
        /// </summary>
        /// <param name="dcm_value">原币值</param>
        /// <param name="context">执行上下文</param>
        /// <param name="guid_transactioncurrencyId">原币</param>
        /// <param name="guid_targetcurrencyId">目标币</param>
        /// <param name="year">年</param>
        /// <param name="month">月</param>
        /// <returns>目标币种金额</returns>
        /// <exception cref="InvalidPluginExecutionException"></exception>
        public static decimal? GetCurrency(this decimal dcm_value, PluginContext context, Guid guid_transactioncurrencyId, Guid guid_targetcurrencyId, int year, int month)
        {
            if (guid_transactioncurrencyId == guid_targetcurrencyId)
            {
                return dcm_value;
            }
            string str_fetchXml = string.Format(@"<fetch top='1' no-lock='true'>
                                              <entity name='apv_exchangerate'>
                                                <attribute name='apv_exchangerate' />
                                                <filter>
                                                  <condition attribute='apv_year' operator='eq' value='{0}' />
                                                  <condition attribute='apv_month' operator='eq' value='{1}' />
                                                  <condition attribute='apv_transactioncurrency_r1' operator='eq' value='{2}' />
                                                  <condition attribute='apv_transactioncurrency_r2' operator='eq' value='{3}' />
                                                </filter>
                                              </entity>
                                            </fetch>", year, month, guid_transactioncurrencyId, guid_targetcurrencyId);
            var result = context.SystemUserService.RetrieveMultiple(new FetchExpression(str_fetchXml));
            if (result.Entities.Count > 0)
            {
                var dcm_exchangerate = result.Entities[0].GetAttributeValue<decimal>("apv_exchangerate");
                return dcm_value * dcm_exchangerate;
            }
            else
            {
                context.Trace(string.Format("未设置年{0}月{1}原币{2}到目标{3}的汇率", year, month, guid_transactioncurrencyId, guid_targetcurrencyId));
                throw new InvalidPluginExecutionException(string.Format("未设置年{0}月{1}原币{2}到目标{3}的汇率", year, month, guid_transactioncurrencyId, guid_targetcurrencyId));
            }
        }

        /// <summary>
        /// 从本币位到目标币种金额
        /// </summary>
        /// <param name="dcm_value"></param>
        /// <param name="context"></param>
        /// <param name="guid_transactioncurrencyId"></param>
        /// <param name="year"></param>
        /// <param name="month"></param>
        /// <returns></returns>
        /// <exception cref="InvalidPluginExecutionException"></exception>
        public static decimal? GetFromBaseCurrency(this decimal dcm_value, PluginContext context, Guid guid_transactioncurrencyId, int year, int month)
        {
            // 如果【币种】=人民币 直接返回原币值
            var guid_rmb = GetEntityRMBGuid(context);
            if (guid_transactioncurrencyId == guid_rmb)
            {
                return dcm_value;
            }
            string str_fetchXml = string.Format(@"<fetch top='1' no-lock='true'>
                                              <entity name='apv_exchangerate'>
                                                <attribute name='apv_exchangerate' />
                                                <filter>
                                                  <condition attribute='apv_year' operator='eq' value='{0}' />
                                                  <condition attribute='apv_month' operator='eq' value='{1}' />
                                                  <condition attribute='apv_transactioncurrency_r1' operator='eq' value='{2}' />
                                                  <condition attribute='apv_transactioncurrency_r2' operator='eq' value='{3}' />
                                                </filter>
                                              </entity>
                                            </fetch>", year, month, guid_rmb, guid_transactioncurrencyId);
            var result = context.SystemUserService.RetrieveMultiple(new FetchExpression(str_fetchXml));

            if (result.Entities.Count > 0)
            {
                var dcm_exchangerate = result.Entities[0].GetAttributeValue<decimal>("apv_exchangerate");
                return dcm_value * dcm_exchangerate;
            }
            else
            {
                context.Trace(string.Format("未设置年{0}月{1}人民币到{2}的汇率", year, month, guid_transactioncurrencyId));
                throw new InvalidPluginExecutionException(string.Format("未设置年{0}月{1}人民币到{2}的汇率", year, month, guid_transactioncurrencyId));
            }
        }

    }
}
