import 'package:file_picker/file_picker.dart';

import 'document_picker.dart';

/// Android / iOS / desktop: native picker via the file_picker plugin.
Future<PickedDocument?> pickFile(List<String> extensions) async {
  final file = await FilePicker.pickFile(
    type: FileType.custom,
    allowedExtensions: extensions,
  );
  if (file == null) return null;
  return PickedDocument(name: file.name, bytes: await file.readAsBytes());
}
