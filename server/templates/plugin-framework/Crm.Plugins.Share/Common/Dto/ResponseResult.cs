using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Crm.Plugins.Share.Common.Dto
{
    public class ResponseResult<T> where T : class
    {
        public int code;
        public string message;
        public List<T> data;
    }
}
