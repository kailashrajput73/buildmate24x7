import '../../data/pipe_schedule_util.dart';
import 'pipes_filter_panel.dart';

/// Canonical class filters shown on the pipe PDP for each material type.
abstract final class PipeConfiguratorClasses {
  static const List<String> upvc = ['Sch 40', 'Sch 80'];
  static const List<String> pvc = ['4 kg', '6 kg', '10 kg'];
  static const List<String> cpvc = ['SDR11', 'SDR13.5'];

  static List<String> optionsForType(String? typeName) {
    switch (typeName?.trim().toUpperCase()) {
      case 'UPVC':
        return upvc;
      case 'PVC':
        return pvc;
      case 'CPVC':
        return cpvc;
      default:
        return const [];
    }
  }

  /// Matches a canonical PDP label to a server [className].
  static bool matchesCanonical(String canonical, String serverClass) {
    final canon = canonical.trim();
    final server = serverClass.trim();
    if (canon.isEmpty || server.isEmpty) return false;

    if (PipeFilterClasses.matches(canon, server)) return true;

    final canonSchedule = PipeScheduleUtil.normalizePipeSchedule(canon);
    final serverSchedule = PipeScheduleUtil.normalizePipeSchedule(server);
    if (canonSchedule != null &&
        serverSchedule != null &&
        PipeFilterClasses.matches(canonSchedule, serverSchedule)) {
      return true;
    }

    final canonKg = _kgValue(canon);
    final serverKg = _kgValue(server);
    if (canonKg != null && serverKg != null && canonKg == serverKg) {
      return true;
    }

    final canonSdr = _sdrValue(canon);
    final serverSdr = _sdrValue(server);
    if (canonSdr != null && serverSdr != null && canonSdr == serverSdr) {
      return true;
    }

    return false;
  }

  /// True when two server class labels refer to the same schedule/pressure tier.
  static bool sameClassBucket(String a, String b) {
    if (PipeFilterClasses.matches(a, b)) return true;
    for (final options in [upvc, pvc, cpvc]) {
      for (final canon in options) {
        if (matchesCanonical(canon, a) && matchesCanonical(canon, b)) {
          return true;
        }
      }
    }
    return false;
  }

  static int? _kgValue(String raw) {
    final match = RegExp(r'(\d+)\s*kg', caseSensitive: false).firstMatch(raw);
    return match == null ? null : int.tryParse(match.group(1)!);
  }

  static String? _sdrValue(String raw) {
    final match = RegExp(r'sdr\s*([\d.]+)', caseSensitive: false).firstMatch(
      raw.replaceAll(' ', ''),
    );
    return match?.group(1);
  }
}
