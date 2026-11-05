import 'dart:typed_data';

import 'pick_file_native.dart'
    if (dart.library.js_interop) 'pick_file_web.dart' as platform;

/// Supporting-document types accepted for KYC uploads.
const kDocumentExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

/// Largest supporting document accepted (5 MB).
const kMaxDocumentBytes = 5 * 1024 * 1024;

class PickedDocument {
  const PickedDocument({required this.name, required this.bytes});

  final String name;
  final Uint8List bytes;
}

/// Thrown when the picked file is not an acceptable supporting document.
class DocumentPickException implements Exception {
  const DocumentPickException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Opens the platform file picker and returns the chosen document, or null
/// if the user cancelled. Uses a plain `<input type="file">` on web and the
/// file_picker plugin elsewhere.
///
/// Throws [DocumentPickException] for a wrong type or oversized file; any
/// other exception means the picker itself could not be opened.
Future<PickedDocument?> pickSupportingDocument() async {
  final file = await platform.pickFile(kDocumentExtensions);
  if (file == null) return null;

  final ext = file.name.contains('.')
      ? file.name.split('.').last.toLowerCase()
      : '';
  if (!kDocumentExtensions.contains(ext)) {
    throw const DocumentPickException('Only PDF, JPG or PNG files are allowed.');
  }
  if (file.bytes.isEmpty) {
    throw const DocumentPickException('The selected file is empty.');
  }
  if (file.bytes.length > kMaxDocumentBytes) {
    throw const DocumentPickException('File is too large. Maximum size is 5 MB.');
  }
  return PickedDocument(name: file.name, bytes: file.bytes);
}
