/// Accept product codes and product-code URLs without treating arbitrary links as codes.
String? parseProductCode(String input) {
  var value = input.trim();
  final uri = Uri.tryParse(value);
  if (uri != null && uri.hasScheme) {
    if (uri.scheme != 'https' && uri.scheme != 'http') return null;
    value = uri.queryParameters['code'] ?? '';
    if (value.isEmpty) {
      final segments = uri.pathSegments;
      final index = segments.indexOf('product');
      if (index >= 0 && index + 1 < segments.length)
        value = segments[index + 1];
    }
  }
  value = value.trim().toUpperCase();
  return RegExp(r'^[A-Z0-9_-]{1,80}$').hasMatch(value) ? value : null;
}
