using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Text;

namespace Crm.Plugins.Share.Common.Dto
{
    public class ActionDto<T> : ActionDto
    {

        [JsonProperty("data")]
        public T Data { get; set; }

    }

    public class ActionDto
    {
        [JsonProperty("name")]
        public string Name { get; set; }


    }

    public class ActionResult
    {
        public bool IsOk { get; set; }

        public string Message { get; set; }

        public object Data { get; set; }

        public ActionResult Error(string msg)
        {
            IsOk = false;
            Message = msg;
            Data = null;
            return this;
        }

        public ActionResult OK(object data)
        {
            IsOk = true;
            Message = "OK";
            Data = data;
            return this;
        }
    }
}
