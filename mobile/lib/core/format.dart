import 'package:intl/intl.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
final _inr0 = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _qty = NumberFormat('#,##0.###', 'en_IN');
final _dt = DateFormat('d MMM yyyy, h:mm a');
final _d = DateFormat('d MMM yyyy');

/// ₹420 for whole rupees, ₹2,232.50 otherwise.
String money(num? v) {
  if (v == null) return '';
  final r = (v * 100).round() / 100;
  return r == r.roundToDouble() ? _inr0.format(r) : _inr.format(r);
}

String qty(num? v) => v == null ? '' : _qty.format(v);

/// API returns UTC; show IST.
DateTime toIst(DateTime utc) => utc.toUtc().add(const Duration(hours: 5, minutes: 30));
String dateTime(String? iso) => iso == null ? '' : _dt.format(toIst(DateTime.parse(iso)));
String date(String? iso) => iso == null ? '' : _d.format(toIst(DateTime.parse(iso)));
