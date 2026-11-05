/// Pipe schedule normalization shared by API mapping and catalog UI.
abstract final class PipeScheduleUtil {
  static String? normalizePipeSchedule(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final text = raw.trim();
    final match =
        RegExp(r'sch\s*(\d+)', caseSensitive: false).firstMatch(text);
    if (match != null) return 'Sch ${match.group(1)}';
    return text;
  }
}
