import 'package:flutter/material.dart';

/// Payment methods offered at checkout step 3.
enum PaymentMethod {
  upi(
    'UPI (GPay / PhonePe / Paytm)',
    'Instant payment with 0 transaction fees',
    Icons.qr_code_2_rounded,
  ),
  card(
    'Credit / Debit Card',
    'Visa, MasterCard, RuPay',
    Icons.credit_card_rounded,
  ),
  netBanking(
    'Net Banking',
    'All major Indian banks supported',
    Icons.account_balance_rounded,
  ),
  cod(
    'Cash on Delivery',
    'Pay at your doorstep upon arrival',
    Icons.payments_outlined,
  );

  const PaymentMethod(this.label, this.subtitle, this.icon);

  final String label;
  final String subtitle;
  final IconData icon;
}

/// Banks listed under Net Banking until the payment gateway provides them.
const List<String> kNetBankingBanks = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
];

/// Checkout input validators.
abstract final class PaymentValidators {
  static final _upi = RegExp(r'^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$');

  static String? upiId(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Enter your UPI ID';
    if (!_upi.hasMatch(v)) return 'Enter a valid UPI ID (e.g. name@okaxis)';
    return null;
  }

  static String? cardNumber(String? value) {
    final digits = (value ?? '').replaceAll(' ', '');
    if (digits.isEmpty) return 'Enter card number';
    if (digits.length < 15 || digits.length > 16 || !_luhn(digits)) {
      return 'Enter a valid card number';
    }
    return null;
  }

  /// MM/YY, not in the past.
  static String? expiry(String? value, {DateTime? now}) {
    final match = RegExp(r'^(\d{2})/(\d{2})$').firstMatch(value ?? '');
    if (match == null) return 'MM/YY';
    final month = int.parse(match[1]!);
    final year = 2000 + int.parse(match[2]!);
    if (month < 1 || month > 12) return 'Invalid month';
    final today = now ?? DateTime.now();
    if (DateTime(
      year,
      month + 1,
    ).isBefore(DateTime(today.year, today.month + 1))) {
      return 'Card expired';
    }
    return null;
  }

  static String? cvv(String? value) =>
      RegExp(r'^\d{3,4}$').hasMatch(value ?? '') ? null : 'Invalid CVV';

  static String? cardName(String? value) =>
      (value?.trim().length ?? 0) < 2 ? 'Enter name on card' : null;

  static bool _luhn(String digits) {
    var sum = 0;
    for (var i = 0; i < digits.length; i++) {
      var d = int.parse(digits[digits.length - 1 - i]);
      if (i.isOdd) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    return sum % 10 == 0;
  }
}
