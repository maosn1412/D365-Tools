using System.Collections.Generic;

namespace Crm.Plugins.Share.Common.Extensions
{
    public static class CollectExtensions
    {
        public static bool IsNullOrEmpty<T>(this IList<T> source) => source == null || source.Count == 0;

        public static bool IsNotNullOrEmpty<T>(this IList<T> source) => !source.IsNullOrEmpty();


    }
}