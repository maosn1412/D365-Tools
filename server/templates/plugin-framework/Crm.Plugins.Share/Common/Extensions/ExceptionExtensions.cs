using Crm.Plugins.Share.Common.Dto;
using System;
using System.Collections.Generic;
using System.Text;

namespace Crm.Plugins.Share.Common.Extensions
{
    public static class ExceptionExtensions
    {
        #region Exception
        /// <summary>
        /// 获取异常信息
        /// </summary>
        /// <param name="ex">异常</param>
        /// <returns></returns>
        public static ExceptionMessageModel GetExceptionMessage(this Exception ex)
        {
            ExceptionMessageModel model = new ExceptionMessageModel();
            if (ex != null)
            {
                model.Message = ex.Message;
                model.StackTrace = ex.StackTrace;
                if (ex.InnerException != null)
                {
                    model.InnerMessage = ex.InnerException.Message;
                    model.InnerStackTrace = ex.InnerException.StackTrace;
                }
            }

            return model;
        }

        /// <summary>
        /// 获取异常的完整信息（包含InnerException的信息）
        /// </summary>
        /// <param name="ex"></param>
        /// <returns></returns>
        public static string GetFullExceptionMessage(this Exception ex)
        {
            ExceptionMessageModel em = GetExceptionMessage(ex);
            StringBuilder sbFullMessage = new StringBuilder();

            if (!string.IsNullOrEmpty(em.Message)) sbFullMessage.AppendLine($"详细信息：{em.Message}。");
            if (!string.IsNullOrEmpty(em.StackTrace)) sbFullMessage.AppendLine($"详细栈信息：{em.StackTrace}。");
            if (!string.IsNullOrEmpty(em.InnerMessage)) sbFullMessage.AppendLine($"内部详细信息：{em.InnerMessage}。");
            if (!string.IsNullOrEmpty(em.InnerStackTrace)) sbFullMessage.AppendLine($"内部详细栈信息：{em.InnerStackTrace}。");

            return sbFullMessage.ToString();
        }
        #endregion Exception

    }
}
