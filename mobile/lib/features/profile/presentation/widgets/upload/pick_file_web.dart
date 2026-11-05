import 'dart:async';
import 'dart:js_interop';

import 'package:web/web.dart' as web;

import 'document_picker.dart';

/// Web: a hidden `<input type="file">` kept in the DOM until the user picks
/// or cancels, then read with `File.arrayBuffer()`.
Future<PickedDocument?> pickFile(List<String> extensions) {
  final completer = Completer<PickedDocument?>();
  final input = web.HTMLInputElement()
    ..type = 'file'
    ..accept = extensions.map((e) => '.$e').join(',')
    ..style.display = 'none';

  void finish(PickedDocument? doc, [Object? error]) {
    input.remove();
    if (completer.isCompleted) return;
    if (error != null) {
      completer.completeError(error);
    } else {
      completer.complete(doc);
    }
  }

  Future<void> read(web.File file) async {
    try {
      final buffer = await file.arrayBuffer().toDart;
      finish(PickedDocument(name: file.name, bytes: buffer.toDart.asUint8List()));
    } catch (e) {
      finish(null, e);
    }
  }

  input.addEventListener(
    'change',
    ((web.Event _) {
      final file = input.files?.item(0);
      if (file == null) {
        finish(null);
      } else {
        read(file);
      }
    }).toJS,
  );
  input.addEventListener('cancel', ((web.Event _) => finish(null)).toJS);

  web.document.body!.append(input);
  input.click();
  return completer.future;
}
