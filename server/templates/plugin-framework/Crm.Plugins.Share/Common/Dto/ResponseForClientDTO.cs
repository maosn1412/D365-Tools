using Newtonsoft.Json;

namespace Crm.Plugins.Share.Common.Dto
{
    /// <summary>
    /// 响应结果(for 客户端)
    /// </summary>
    public class ResponseForClientDTO
    {
        public ResponseForClientDTO()
        {
            IsSuccess = true;
            Code = 200;
        }
        [JsonProperty("isSuccess")]
        public bool IsSuccess;
        [JsonProperty("code")]
        public int Code;
        [JsonProperty("message")]
        public string Message;
        [JsonProperty("data")]
        public object Data;
    }
}
