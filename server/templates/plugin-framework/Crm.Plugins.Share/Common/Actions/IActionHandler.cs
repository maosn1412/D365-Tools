using Crm.Plugins.Share.Common.Dto;
using System;
using System.Collections.Generic;
using System.Text;

namespace Crm.Plugins.Share.Common.Actions
{
    public interface IActionHandler
    {
        ActionResult Handle(string data, PluginContext ctx);
    }

}
