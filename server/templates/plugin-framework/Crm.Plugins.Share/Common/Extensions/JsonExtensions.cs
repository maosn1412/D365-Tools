using System;
using System.IO;
using System.Runtime.Serialization.Json;
using System.Text;
using Newtonsoft.Json;

namespace Crm.Plugins.Share.Common.Extensions
{
    /// <summary>
    /// JSON扩展类
    /// </summary>
    public static class JsonExtensions
    {
        /// <summary>
        /// 将对象转换为JSON字符串
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="entity"></param>
        /// <returns></returns>
        public static string ToJson<T>(this T entity)
        {
            //return JsonSerializer.Serialize<T>(entity);
            //DataContractJsonSerializer js = new DataContractJsonSerializer(typeof(T));
            //MemoryStream msObj = new MemoryStream();
            //js.WriteObject(msObj, entity);
            //msObj.Position = 0;
            //StreamReader sr = new StreamReader(msObj); 
            //string json = sr.ReadToEnd();

            //sr.Close();
            //msObj.Close();
            //return json;
            return JsonConvert.SerializeObject(entity);
        }
        /// <summary>
        /// 将字符串转换为对象
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="json"></param>
        /// <returns></returns>
        public static T FromJson<T>(this string json)
        {
            //return JsonSerializer.Deserialize<T>(json);

            //using (var ms = new MemoryStream(Encoding.Unicode.GetBytes(json)))
            //{
            //    // Deserialization from JSON
            //    DataContractJsonSerializer deserializer = new DataContractJsonSerializer(typeof(T)); 
            //    return (T)deserializer.ReadObject(ms);
            //}
            return JsonConvert.DeserializeObject<T>(json);
        }
    }
}
