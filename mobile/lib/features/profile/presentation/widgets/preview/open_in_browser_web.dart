import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

/// Opens [bytes] in a new browser tab via a blob URL (same as the dashboard's
/// `URL.createObjectURL` + `window.open`).
bool openBytesInBrowser(Uint8List bytes, String fileName) {
  final blob = web.Blob(
    [bytes.toJS].toJS,
    web.BlobPropertyBag(type: _mimeType(fileName)),
  );
  final url = web.URL.createObjectURL(blob);
  web.window.open(url, '_blank', 'noopener');
  return true;
}

String _mimeType(String fileName) {
  final name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}
