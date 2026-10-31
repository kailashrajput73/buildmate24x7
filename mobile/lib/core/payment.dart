import 'dart:async';

import 'package:flutter_cashfree_pg_sdk/api/cferrorresponse/cferrorresponse.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpayment/cfwebcheckoutpayment.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpaymentgateway/cfpaymentgatewayservice.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfsession/cfsession.dart';
import 'package:flutter_cashfree_pg_sdk/utils/cfenums.dart';
import 'package:flutter_cashfree_pg_sdk/utils/cfexceptions.dart';

import '../data/models.dart';

enum PayOutcome { returned, failed }

/// Opens Cashfree checkout. "returned" only means the user came back — the API must confirm the payment
/// (POST /api/orders/{id}/confirm-payment), which checks with Cashfree server-to-server.
class CashfreePayment {
  static Future<({PayOutcome outcome, String? message})> pay(CheckoutResult r) async {
    if (r.environment == 'mock') return (outcome: PayOutcome.returned, message: null);

    if (r.environment != 'sandbox' && r.environment != 'production') {
      return (outcome: PayOutcome.failed, message: 'Invalid payment environment returned by the server.');
    }

    final done = Completer<({PayOutcome outcome, String? message})>();
    final service = CFPaymentGatewayService();
    service.setCallback(
      (String orderId) { if (!done.isCompleted) done.complete((outcome: PayOutcome.returned, message: null)); },
      (CFErrorResponse error, String orderId) {
        if (!done.isCompleted) done.complete((outcome: PayOutcome.failed, message: error.getMessage()));
      },
    );
    try {
      final session = CFSessionBuilder()
          .setEnvironment(r.environment == 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX)
          .setOrderId(r.gatewayOrderId)
          .setPaymentSessionId(r.paymentSessionId)
          .build();
      final payment = CFWebCheckoutPaymentBuilder().setSession(session).build();
      service.doPayment(payment);
    } on CFException catch (e) {
      return (outcome: PayOutcome.failed, message: e.toString());
    }
    return done.future;
  }
}
