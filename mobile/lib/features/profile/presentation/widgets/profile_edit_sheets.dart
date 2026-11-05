import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/models/profile_models.dart';
import 'profile_document_preview.dart';
import 'profile_widgets.dart';
import 'upload/document_picker.dart';

/// Opens the Personal Information edit sheet. Returns the edited info, or
/// null when dismissed.
Future<PersonalInfo?> showPersonalInfoEditSheet(
  BuildContext context,
  PersonalInfo info,
) {
  return _showSheet(
    context,
    _FormSheet(
      title: 'Edit Personal Information',
      fields: [
        _FieldSpec('Full Name', info.fullName,
            validator: (v) => ProfileValidators.required(v, 'Full name'),
            capitalization: TextCapitalization.words),
        _FieldSpec('Mobile Number', info.mobileNumber,
            readOnly: true, helper: 'Mobile number cannot be changed'),
        _FieldSpec('Email Address', info.email,
            validator: ProfileValidators.email,
            keyboardType: TextInputType.emailAddress),
        _FieldSpec('Address', info.address,
            validator: (v) => ProfileValidators.required(v, 'Address'),
            maxLines: 3),
      ],
      onSave: (v, _) => info.copyWith(
        fullName: v[0].trim(),
        email: v[2].trim(),
        address: v[3].trim(),
      ),
    ),
  );
}

Future<PanDetails?> showPanEditSheet(BuildContext context, PanDetails pan) {
  return _showSheet(
    context,
    _FormSheet(
      title: 'Edit PAN Details',
      requiresApproval: true,
      document: pan.document,
      fields: [
        _FieldSpec('PAN Number', pan.panNumber,
            validator: ProfileValidators.pan,
            capitalization: TextCapitalization.characters,
            maxLength: 10),
        _FieldSpec('Name on Document', pan.nameOnDocument,
            validator: (v) => ProfileValidators.required(v, 'Name'),
            capitalization: TextCapitalization.words),
      ],
      onSave: (v, doc) => PanDetails(
        panNumber: v[0],
        nameOnDocument: v[1],
        document: doc ?? pan.document,
        status: VerificationStatus.pending,
      ),
    ),
  );
}

Future<GstDetails?> showGstEditSheet(BuildContext context, GstDetails gst) {
  return _showSheet(
    context,
    _FormSheet(
      title: 'Edit GST Details',
      requiresApproval: true,
      document: gst.document,
      fields: [
        _FieldSpec('GST Number', gst.gstNumber,
            validator: ProfileValidators.gst,
            capitalization: TextCapitalization.characters,
            maxLength: 15),
        _FieldSpec('Name on Document', gst.nameOnDocument,
            validator: (v) => ProfileValidators.required(v, 'Name'),
            capitalization: TextCapitalization.words),
      ],
      onSave: (v, doc) => GstDetails(
        gstNumber: v[0],
        nameOnDocument: v[1],
        document: doc ?? gst.document,
        status: VerificationStatus.pending,
      ),
    ),
  );
}

Future<BankDetails?> showBankEditSheet(BuildContext context, BankDetails bank) {
  return _showSheet(
    context,
    _FormSheet(
      title: 'Edit Bank Details',
      requiresApproval: true,
      document: bank.document,
      fields: [
        // The stored number is masked, so the full number must be re-entered.
        _FieldSpec('Account Number', '',
            hint: bank.accountNumber,
            validator: ProfileValidators.accountNumber,
            keyboardType: TextInputType.number,
            digitsOnly: true,
            maxLength: 18),
        _FieldSpec('IFSC Code', bank.ifscCode,
            validator: ProfileValidators.ifsc,
            capitalization: TextCapitalization.characters,
            maxLength: 11),
        _FieldSpec('Name on Bank Account', bank.nameOnAccount,
            validator: (v) => ProfileValidators.required(v, 'Name'),
            capitalization: TextCapitalization.words),
      ],
      onSave: (v, doc) => BankDetails(
        accountNumber: v[0],
        ifscCode: v[1],
        nameOnAccount: v[2],
        document: doc ?? bank.document,
        status: VerificationStatus.pending,
      ),
    ),
  );
}

Future<T?> _showSheet<T>(BuildContext context, Widget sheet) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    // The sheet draws its own handle; suppress the theme's default one.
    showDragHandle: false,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
    ),
    builder: (_) => sheet,
  );
}

class _FieldSpec {
  const _FieldSpec(
    this.label,
    this.initial, {
    this.validator,
    this.hint,
    this.helper,
    this.readOnly = false,
    this.keyboardType,
    this.capitalization = TextCapitalization.none,
    this.maxLines = 1,
    this.maxLength,
    this.digitsOnly = false,
  });

  final String label;
  final String initial;
  final String? Function(String?)? validator;
  final String? hint;
  final String? helper;
  final bool readOnly;
  final TextInputType? keyboardType;
  final TextCapitalization capitalization;
  final int maxLines;
  final int? maxLength;
  final bool digitsOnly;
}

class _FormSheet<T> extends StatefulWidget {
  const _FormSheet({
    required this.title,
    required this.fields,
    required this.onSave,
    this.requiresApproval = false,
    this.document,
  });

  final String title;
  final List<_FieldSpec> fields;

  /// Builds the result from the trimmed field values (same order as [fields])
  /// and the supporting document (the replacement, if one was picked).
  final T Function(List<String> values, ProfileDocument? document) onSave;
  final bool requiresApproval;
  final ProfileDocument? document;

  @override
  State<_FormSheet<T>> createState() => _FormSheetState<T>();
}

class _FormSheetState<T> extends State<_FormSheet<T>> {
  final _formKey = GlobalKey<FormState>();
  late final List<TextEditingController> _controllers = [
    for (final f in widget.fields) TextEditingController(text: f.initial),
  ];
  late ProfileDocument? _document = widget.document;
  bool _picking = false;

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final values = [for (final c in _controllers) c.text.trim()];
    Navigator.of(context).pop(widget.onSave(values, _document));
  }

  Future<void> _replaceDocument() async {
    if (_picking) return;
    setState(() => _picking = true);
    final PickedDocument? picked;
    try {
      picked = await pickSupportingDocument();
    } on DocumentPickException catch (e) {
      _showMessage(e.message);
      return;
    } catch (e) {
      debugPrint('File picker failed: $e');
      _showMessage('Could not open the file picker.');
      return;
    } finally {
      if (mounted) setState(() => _picking = false);
    }
    if (picked == null || !mounted) return;
    // Keep the content so the new document can be previewed before and
    // after submitting (there is no backend to upload it to yet).
    setState(() {
      _document = ProfileDocument(
        fileName: picked!.name,
        uploadedOn: DateTime.now(),
        bytes: picked.bytes,
      );
    });
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space4,
          AppSpacing.space3,
          AppSpacing.space4,
          AppSpacing.space6,
        ),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.outlineVariant,
                    borderRadius: AppRadius.pillAll,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.space4),
              Row(
                children: [
                  Expanded(
                    child: Text(widget.title, style: theme.textTheme.titleMedium),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                    tooltip: 'Close',
                  ),
                ],
              ),
              if (widget.requiresApproval) ...[
                const SizedBox(height: AppSpacing.space2),
                Container(
                  padding: const EdgeInsets.all(AppSpacing.space3),
                  decoration: BoxDecoration(
                    color: AppColors.warningContainer,
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Text(
                    'Changes will be sent to the backend team for approval. '
                    'Approved details cannot be changed later.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.space4),
              for (var i = 0; i < widget.fields.length; i++) ...[
                _buildField(widget.fields[i], _controllers[i]),
                const SizedBox(height: AppSpacing.space3),
              ],
              if (widget.requiresApproval) ...[
                Text(
                  'Supporting Document',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: AppColors.outline,
                  ),
                ),
                const SizedBox(height: AppSpacing.space2),
                if (_document != null)
                  Container(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.space3,
                      AppSpacing.space2,
                      AppSpacing.space1,
                      AppSpacing.space2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainer,
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(color: AppColors.divider),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: ProfileDocumentTile(
                            document: _document!,
                            onView: () => showProfileDocument(context, _document!),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: _replaceDocument,
                          icon: const Icon(Icons.file_upload_outlined, size: 18),
                          label: const Text('Replace'),
                        ),
                      ],
                    ),
                  )
                else
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: _replaceDocument,
                      icon: const Icon(Icons.upload_file_rounded, size: 18),
                      label: const Text('Upload Document (Optional)'),
                    ),
                  ),
                const SizedBox(height: AppSpacing.space4),
              ],
              FilledButton(
                onPressed: _submit,
                child: Text(
                  widget.requiresApproval ? 'Submit for Approval' : 'Save Changes',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(_FieldSpec f, TextEditingController c) {
    return TextFormField(
      controller: c,
      readOnly: f.readOnly,
      enabled: !f.readOnly,
      validator: f.validator,
      keyboardType: f.maxLines > 1 ? TextInputType.multiline : f.keyboardType,
      textCapitalization: f.capitalization,
      maxLines: f.maxLines,
      maxLength: f.maxLength,
      inputFormatters: [
        if (f.digitsOnly) FilteringTextInputFormatter.digitsOnly,
        if (f.capitalization == TextCapitalization.characters)
          _UpperCaseFormatter(),
      ],
      decoration: InputDecoration(
        labelText: f.readOnly ? f.label : '${f.label} *',
        hintText: f.hint,
        helperText: f.helper,
        counterText: '',
        suffixIcon: f.readOnly
            ? const Icon(Icons.lock_outline_rounded, size: 18)
            : null,
      ),
    );
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}
