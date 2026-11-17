using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Crm.Plugins.Share.Common.Dto
{
    /// <summary>
    /// 异常信息
    /// </summary>
    public class ExceptionMessageModel
    {
        /// <summary>
        /// 异常信息内容
        /// </summary>
        public string Message { get; set; }

        /// <summary>
        /// 异常堆栈
        /// </summary>
        public string StackTrace { get; set; }

        /// <summary>
        /// 异常内部信息
        /// </summary>
        public string InnerMessage { get; set; }

        /// <summary>
        /// 异常内部堆栈
        /// </summary>
        public string InnerStackTrace { get; set; }
    }
}
