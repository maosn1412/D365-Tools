namespace Crm.Plugins.Share.Common.Extensions
{
    using System;

    /// <summary>
    /// Extensions for DateTime
    /// </summary>
    public static class DateTimeExtensions
    {
        /// <summary>
        /// Epoch represented as DateTime
        /// </summary>
        internal static readonly DateTime Epoch;

        static DateTimeExtensions() => Epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        /// <summary>
        /// Converts a given <see cref="DateTime"/> to milliseconds from Epoch.
        /// </summary>
        /// <param name="dateTime">A given <see cref="DateTime"/></param>
        /// <returns>Milliseconds since Epoch</returns>
        public static long ToEpochMilliseconds(this DateTime dateTime) =>
            (long)dateTime.ToUniversalTime().Subtract(Epoch).TotalMilliseconds;

        /// <summary>
        /// Converts a given <see cref="DateTime"/> to seconds from Epoch.
        /// </summary>
        /// <param name="dateTime">A given <see cref="DateTime"/></param>
        /// <returns>The Unix time stamp</returns>
        public static long ToEpochSeconds(this DateTime dateTime) =>
            dateTime.ToEpochMilliseconds() / 1000;

        /// <summary>
        /// Checks the given date is between the two provided dates
        /// </summary>
        public static bool IsBetween(this DateTime date, DateTime startDate, DateTime endDate, bool compareTime = false) =>
            compareTime ? date >= startDate && date <= endDate : date.Date >= startDate.Date && date.Date <= endDate.Date;

        /// <summary>
        /// Returns whether the given date is the last day of the month
        /// </summary>
        public static bool IsLastDayOfTheMonth(this DateTime dateTime) =>
            dateTime == new DateTime(dateTime.Year, dateTime.Month, 1).AddMonths(1).AddDays(-1);

        /// <summary>
        /// Returns whether the given date falls in a weekend
        /// </summary>
        public static bool IsWeekend(this DateTime value) =>
            value.DayOfWeek == DayOfWeek.Sunday || value.DayOfWeek == DayOfWeek.Saturday;

        /// <summary>
        /// Determines if a given year is a LeapYear or not.
        /// </summary>
        public static bool IsLeapYear(this DateTime value) =>
            DateTime.DaysInMonth(value.Year, 2) == 29;

        /// <summary>
        /// Returns the age based on <paramref name="birthDay"/>.
        /// </summary>
        /// <param name="birthDay">The birthday for which age should be calculated</param>
        public static int Age(this DateTime birthDay)
        {
            var today = DateTime.Today;
            var age = today.Year - birthDay.Year;

            if (birthDay > today.AddYears(-age)) { age--; }
            return age;
        }

        /// <summary>  
        /// 时间戳Timestamp转换成日期  
        /// </summary>  
        /// <param name="timeStamp"></param>  
        /// <returns></returns>  
        public static DateTime ToDateTime(this string timeStamp)
        {
            DateTime dtStart = Epoch;

            long lTime = long.Parse(timeStamp + "0000000");
            TimeSpan toNow = new TimeSpan(lTime);

            return dtStart.Add(toNow);
        }
    }
}