using System;
using System.Collections.Generic;
using System.Security.Policy;
using System.Text;

namespace Crm.Plugins.Share.Common
{
    public class Enums
    {
        /// <summary>
        /// {状态, statecode}
        /// </summary>
        public enum StateCode : int
        {
            可用 = 0,
            停用 = 1
        }

        /// <summary>
        /// {状态描述, statuscode}
        /// </summary>
        public enum StatusCode : int
        {
            Active = 1,
            Finished = 2,
            Aborted = 3
        }

        /// <summary>
        /// {是/否, apv_yesorno}
        /// </summary>
        public enum YesOrNo : int
        {
            Yes = 10,
            No = 20
        }

        /// <summary>
        /// {订单进度, apv_sostatus}
        /// </summary>
        public enum SOStatus : int
        {
            草稿 = 10,
            已提交审批 = 20,
            已同步SAP = 30,
            已排产 = 40,//Modify by ivan in 20230821 【由《排产中》变更为《已排产》】
            部分出库 = 50,
            全部出库 = 60
        }

        /// <summary>
        /// {等客户付款, apv_waitcustomer}
        /// </summary>
        public enum WaitCustomer : int
        {
            等客户付款 = 10,
            已付款等新单 = 20,
            已付款等货齐 = 30,
            已付款等船期 = 40,
            已付款等货代信息确认 = 50,
            本月可出 = 60,
            已付款下周可出 = 70
        }

        /// <summary>
        /// {交易类型, apv_tradetype}
        /// </summary>
        public enum TradeType : int
        {
            直接交易 = 10,
            间接交易 = 20
        }

        /// <summary>
        /// {审批状态, apv_approvestatus}
        /// </summary>
        public enum ApproveStatus : int
        {
            草稿 = 10,
            审批中 = 20,
            审批通过 = 30,
            审批驳回 = 40,
        }

        #region 【销售订单, apv_purchaseorder】

        /// <summary>
        /// {审批状态, apv_approvestatus}
        /// </summary>
        public enum PurchaseOrderApproveStatus : int
        {
            草稿 = 10,
            审批中 = 20,
            审批驳回 = 30,
            审批通过 = 40,
            已同步 = 50
        }

        /// <summary>
        /// {订单状态, apv_status}
        /// </summary>
        public enum PurchaseOrderStatus : int
        {
            草稿 = 10,
            处理中 = 20,
            已提交 = 30,
            待排产 = 40,
            已排产 = 50,
            已排产未完成 = 60,
            已完成 = 70,
            已关闭 = 80,
            已取消 = 90,
            部分变更 = 100
        }

        #endregion

        #region 【客户价目表明细, apv_productpricelevel】

        /// <summary>
        /// {产品价格状态, apv_pricestatus}
        /// </summary>
        public enum PriceStatus : int
        {
            草稿 = 10,
            审批中 = 20,
            审批驳回 = 30,
            审批通过 = 40,
            已作废 = 50
        }

        #endregion

        #region 【订单目标, apv_sogoal】

        /// <summary>
        /// {记录类型, apv_type}
        /// </summary>
        public enum SOGoalRecordType : int
        {
            收入目标收单金额 = 10,
            收入目标出货金额 = 20,
            产品目标出货金额 = 30
        }

        #endregion

        #region 【订单预测, apv_soforecast】

        /// <summary>
        /// {记录类型, apv_type}
        /// </summary>
        public enum SOForecastRecordType : int
        {
            销售预测收单数量 = 10,
            销售预测出货数量 = 20
        }

        #endregion

        /// <summary>
        /// ERP同步状态
        /// </summary>
        public enum ErpSyncStatus
        {
            成功 = 10,
            失败 = 20
        }
        /// <summary>
        /// ERP同步阶段
        /// </summary>
        public enum ErpStage
        {
            查询最大编码 = 10,
            HS01 = 20,
            HS06 = 30,
        }
        /// <summary>
        /// 客户状态
        /// </summary>
        public enum CustomerStatus
        {
            草稿 = 10,
            生效 = 20,
            失效 = 30
        }
        /// <summary>
        /// 客户分类
        /// </summary>
        public enum CustomerType
        {
            集团客户 = 10,
            加盟店 = 20,
            发票客户 = 30,
            一次性客户 = 40
        }
    }
}
