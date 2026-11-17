using System;
using System.ComponentModel.DataAnnotations;


namespace Crm.Plugins.Share.Common
{
    public enum MessageMode
    {
        /// <summary>
        /// 同步
        /// </summary>
        Synchronous,

        /// <summary>
        /// 异步
        /// </summary>
        Asynchronous
    }
    public enum MessageStage
    {
        /// <summary>
        /// 预验证
        /// </summary>
        PreValidation = 10,

        /// <summary>
        /// 执行前
        /// </summary>
        PreOperation = 20,

        /// <summary>
        /// 执行后
        /// </summary>
        PostOperation = 40
    }
    public enum MessageSupportedDeployment
    {
        ServerOnly,
        OfflineOnly,
        Both
    }
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public class MessageCreate : Attribute
    {
        /// <summary>
        /// 注册实体
        /// </summary>
        [Required]
        public string PrimaryEntityName { get; set; }

        public string FilteringAttributes { get; set; }

        /// <summary>
        /// 默认同步
        /// </summary>
        public MessageMode Mode { get; set; } = MessageMode.Synchronous;

        [Required]
        public MessageStage Stage { get; set; } = MessageStage.PostOperation;

        public string PostAttributes { get; set; }
        /// <summary>
        /// 排序
        /// </summary>
        public int Rank { get; set; } = 1;

        /// <summary>
        /// 描述
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// 非安全配置
        /// </summary>
        public string UnSecure { get; set; }

        /// <summary>
        /// 安全配置
        /// </summary>
        public string Secure { get; set; }

        public MessageSupportedDeployment SupportedDeployment { get; set; } = MessageSupportedDeployment.ServerOnly;
    }

    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public class MessageUpdate : Attribute
    {
        /// <summary>
        /// 注册实体
        /// </summary>
        public string PrimaryEntityName { get; set; }
        /// <summary>
        /// 注册属性
        /// </summary>
        public string FilteringAttributes { get; set; }
        /// <summary>
        /// 同步/异步
        /// </summary>
        public MessageMode Mode { get; set; } = MessageMode.Synchronous;
        public string PostAttributes { get; set; }
        public string PreAttributes { get; set; }
        [Required]
        public MessageStage Stage { get; set; } = MessageStage.PostOperation;
        /// <summary>
        /// 排序
        /// </summary>
        public int Rank { get; set; } = 1;

        /// <summary>
        /// 描述
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// 非安全配置
        /// </summary>
        public string UnSecure { get; set; }

        /// <summary>
        /// 安全配置
        /// </summary>
        public string Secure { get; set; }

        public MessageSupportedDeployment SupportedDeployment { get; set; } = MessageSupportedDeployment.ServerOnly;
    }

    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public class MessageDelete : Attribute
    {
        /// <summary>
        /// 注册实体
        /// </summary>
        public string PrimaryEntityName { get; set; }
        public string PostAttributes { get; set; }
        public string PreAttributes { get; set; }
        public MessageMode Mode { get; set; } = MessageMode.Synchronous;
        [Required]
        public MessageStage Stage { get; set; } = MessageStage.PostOperation;
        /// <summary>
        /// 排序
        /// </summary>
        public int Rank { get; set; } = 1;

        /// <summary>
        /// 描述
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// 非安全配置
        /// </summary>
        public string UnSecure { get; set; }

        /// <summary>
        /// 安全配置
        /// </summary>
        public string Secure { get; set; }
        public MessageSupportedDeployment SupportedDeployment { get; set; } = MessageSupportedDeployment.ServerOnly;
    }

    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public class MessageRetrieveMultiple : Attribute
    {
        /// <summary>
        /// 注册实体
        /// </summary>
        public string PrimaryEntityName { get; set; }
        public string PostAttributes { get; set; }
        public string PreAttributes { get; set; }
        public MessageMode Mode { get; set; } = MessageMode.Synchronous;
        [Required]
        public MessageStage Stage { get; set; } = MessageStage.PostOperation;
        /// <summary>
        /// 排序
        /// </summary>
        public int Rank { get; set; } = 1;

        /// <summary>
        /// 描述
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// 非安全配置
        /// </summary>
        public string UnSecure { get; set; }

        /// <summary>
        /// 安全配置
        /// </summary>
        public string Secure { get; set; }

        public MessageSupportedDeployment SupportedDeployment { get; set; } = MessageSupportedDeployment.ServerOnly;
    }


    /// <summary>
    /// 可自定义注册步骤
    /// </summary>
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public class MessageCustom : Attribute
    {
        public string MessageName { get; set; }
        /// <summary>
        /// 注册实体
        /// </summary>
        public string PrimaryEntityName { get; set; }
        /// <summary>
        /// 注册属性
        /// </summary>
        public string FilteringAttributes { get; set; }
        /// <summary>
        /// 同步/异步
        /// </summary>
        public MessageMode Mode { get; set; } = MessageMode.Synchronous;
        public string PostAttributes { get; set; }
        public string PreAttributes { get; set; }
        [Required]
        public MessageStage Stage { get; set; } = MessageStage.PostOperation;
        /// <summary>
        /// 排序
        /// </summary>
        public int Rank { get; set; } = 1;

        /// <summary>
        /// 描述
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// 非安全配置
        /// </summary>
        public string UnSecure { get; set; }

        /// <summary>
        /// 安全配置
        /// </summary>
        public string Secure { get; set; }

        public MessageSupportedDeployment SupportedDeployment { get; set; } = MessageSupportedDeployment.ServerOnly;
    }
}
