import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/models/profile_models.dart';
import 'preview/open_in_browser_stub.dart'
    if (dart.library.js_interop) 'preview/open_in_browser_web.dart';

/// "View document" action. On web the file opens in a new tab; on mobile
/// images open in a dialog. Seeded documents have no content to show.
void showProfileDocument(BuildContext context, ProfileDocument document) {
  final bytes = document.bytes;
  if (bytes == null) {
    return _snack(
      context,
      'Preview is only available for documents uploaded in this session',
    );
  }
  if (openBytesInBrowser(bytes, document.fileName)) return;
  if (document.isPdf) {
    return _snack(context, 'PDF preview is not available on this device yet');
  }
  showDialog<void>(
    context: context,
    builder: (context) => Dialog(
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.space4,
              AppSpacing.space2,
              AppSpacing.space1,
              AppSpacing.space2,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    document.fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                  tooltip: 'Close',
                ),
              ],
            ),
          ),
          Flexible(
            child: InteractiveViewer(
              child: Image.memory(bytes, fit: BoxFit.contain),
            ),
          ),
        ],
      ),
    ),
  );
}

void _snack(BuildContext context, String message) {
  ScaffoldMessenger.maybeOf(context)?.showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
  );
}
