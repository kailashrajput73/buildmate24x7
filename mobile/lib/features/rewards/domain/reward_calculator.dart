/// Single place for reward-point math. Change formula here only.
abstract final class RewardCalculator {
  /// Demo rule: ₹100 = 1 point → floor(grandTotal / 100).
  static int pointsFromGrandTotal(double grandTotal) {
    if (grandTotal <= 0) return 0;
    return grandTotal.floor() ~/ 100;
  }
}
