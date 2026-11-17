using System.Collections.Generic;

namespace Crm.Plugins.Share.Common.Extensions
{
    public static class DictionaryExtensions
    {
        public static TValue Get<TKey, TValue>(this Dictionary<TKey, TValue> dic, TKey key)
        {
            if (dic == null || dic.Count == 0 || !dic.ContainsKey(key)) return default(TValue);

            return dic[key];
        }

        public static string String(this Dictionary<string, string> dic, string key)
        {
            return dic.Get<string, string>(key);
        }
    }
}
