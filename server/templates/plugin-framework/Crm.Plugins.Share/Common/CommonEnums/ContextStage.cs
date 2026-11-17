using System;
using System.Collections.Generic;
using System.Text;

namespace Crm.Plugins.Share.Common.CommonEnums
{
    /// <summary>
    /// PluginContextStage
    /// </summary>
    public enum ContextStage
    {
        /// <summary>
        /// Pre-Validation
        /// </summary>
        PreValidation = 10,
        /// <summary>
        /// Pre-Operation
        /// </summary>
        PreOperation = 20,
        /// <summary>
        /// Post-Operation
        /// </summary>
        PostOperation = 40
    }
}
