import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

const partnerTypes = {'Plumber': 'Plumber / प्लंबर', 'Electrician': 'Electrician / इलेक्ट्रीशियन', 'Contractor': 'Contractor / ठेकेदार', 'Builder': 'Builder / बिल्डर', 'Flooring': 'Flooring / फ़्लोरिंग', 'Other': 'Other / अन्य'};

/// Step 1 of registration (also used to edit the profile later).
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key, this.editing = false});
  final bool editing;
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterState();
}

class _RegisterState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final c = {for (final k in ['name', 'businessName', 'addressLine', 'area', 'city', 'state', 'pincode', 'gstin', 'email']) k: TextEditingController()};
  String _type = 'Plumber';
  double? _lat, _lng;
  bool _busy = false, _loaded = false, _locating = false;

  @override
  void dispose() {
    for (final x in c.values) {
      x.dispose();
    }
    super.dispose();
  }

  void _fill(PartnerProfile p) {
    if (_loaded) return;
    _loaded = true;
    c['name']!.text = p.name;
    c['businessName']!.text = p.businessName ?? '';
    c['addressLine']!.text = p.addressLine ?? '';
    c['area']!.text = p.area ?? '';
    c['city']!.text = p.city ?? '';
    c['state']!.text = p.state ?? 'Gujarat';
    c['pincode']!.text = p.pincode ?? '';
    c['gstin']!.text = p.gstin ?? '';
    c['email']!.text = p.email ?? '';
    _type = partnerTypes.containsKey(p.partnerType) ? p.partnerType : 'Other';
    _lat = p.latitude;
    _lng = p.longitude;
  }

  /// Location helps the store verify the partner's shop/site. Optional.
  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        if (mounted) toast(context, 'Location permission is off. You can skip this step.', error: true);
        return;
      }
      final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      setState(() { _lat = pos.latitude; _lng = pos.longitude; });
    } catch (_) {
      if (mounted) toast(context, 'Could not get location. Turn on GPS and try again.', error: true);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await ref.read(kycRepoProvider).saveProfile({
        'name': c['name']!.text.trim(), 'partnerType': _type, 'businessName': c['businessName']!.text.trim(),
        'addressLine': c['addressLine']!.text.trim(), 'area': c['area']!.text.trim(), 'city': c['city']!.text.trim(),
        'state': c['state']!.text.trim(), 'pincode': c['pincode']!.text.trim(), 'gstin': c['gstin']!.text.trim(),
        'email': c['email']!.text.trim(), 'preferredLanguage': ref.read(langProvider), 'latitude': _lat, 'longitude': _lng,
      });
      await ref.read(authProvider.notifier).refreshMe();
      ref.invalidate(profileProvider);
      if (!mounted) return;
      if (widget.editing) {
        toast(context, 'Profile saved');
        context.pop();
      } else {
        context.go('/kyc');
      }
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(trProvider);
    final profile = ref.watch(profileProvider);
    profile.whenData(_fill);
    String? req(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

    return Scaffold(
      appBar: AppBar(title: Text(widget.editing ? t('kyc.profile') : t('kyc.title')), automaticallyImplyLeading: widget.editing),
      body: profile.isLoading && !_loaded
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _form,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                if (!widget.editing) ...[
                  const _Steps(step: 0),
                  const SizedBox(height: 16),
                ],
                TextFormField(controller: c['name'], decoration: const InputDecoration(labelText: 'Full name'), validator: req, textCapitalization: TextCapitalization.words),
                const SizedBox(height: 12),
                Text('I am a', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 6),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final e in partnerTypes.entries)
                    ChoiceChip(label: Text(e.value), selected: _type == e.key, onSelected: (_) => setState(() => _type = e.key)),
                ]),
                const SizedBox(height: 12),
                TextFormField(controller: c['businessName'], decoration: const InputDecoration(labelText: 'Shop / business name (optional)')),
                const SizedBox(height: 12),
                TextFormField(controller: c['addressLine'], decoration: const InputDecoration(labelText: 'Address'), validator: req),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: TextFormField(controller: c['area'], decoration: const InputDecoration(labelText: 'Area'))),
                  const SizedBox(width: 12),
                  Expanded(child: TextFormField(controller: c['city'], decoration: const InputDecoration(labelText: 'City'), validator: req)),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: TextFormField(controller: c['state'], decoration: const InputDecoration(labelText: 'State'), validator: req)),
                  const SizedBox(width: 12),
                  Expanded(child: TextFormField(
                    controller: c['pincode'], decoration: const InputDecoration(labelText: 'Pincode', counterText: ''), keyboardType: TextInputType.number,
                    maxLength: 6, inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    validator: (v) => v == null || v.length != 6 ? '6 digits' : null,
                  )),
                ]),
                const SizedBox(height: 12),
                TextFormField(
                  controller: c['gstin'], decoration: const InputDecoration(labelText: 'GSTIN (optional)', counterText: ''), maxLength: 15,
                  textCapitalization: TextCapitalization.characters,
                  validator: (v) => v != null && v.isNotEmpty && v.length != 15 ? 'GSTIN has 15 characters' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(controller: c['email'], decoration: const InputDecoration(labelText: 'Email (optional)'), keyboardType: TextInputType.emailAddress),
                const SizedBox(height: 12),
                Card(
                  child: ListTile(
                    leading: Icon(_lat != null ? Icons.location_on : Icons.location_on_outlined, color: _lat != null ? BM.leaf : BM.pipe),
                    title: Text(_lat != null ? 'Shop / site location saved' : 'Share your shop or site location'),
                    subtitle: const Text('Optional — helps us verify you faster'),
                    trailing: _locating ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location),
                    onTap: _locating ? null : _locate,
                  ),
                ),
                const SizedBox(height: 20),
                FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? '…' : widget.editing ? t('common.save') : 'Continue')),
              ]),
            ),
    );
  }
}

class _Steps extends StatelessWidget {
  const _Steps({required this.step});
  final int step;
  @override
  Widget build(BuildContext context) => Row(children: [
        for (final (i, l) in const ['Your details', 'Documents', 'Approval'].indexed) ...[
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(height: 4, decoration: BoxDecoration(color: i <= step ? BM.leaf : BM.line, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 4),
              Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: i <= step ? BM.ink : BM.inkFaint)),
            ]),
          ),
          if (i < 2) const SizedBox(width: 6),
        ],
      ]);
}

const _docTypes = [
  ('Aadhaar', 'Aadhaar card', 'Front side, all four corners visible', true),
  ('Pan', 'PAN card', 'Either Aadhaar or PAN is required', true),
  ('ShopPhoto', 'Shop or site photo', 'Optional — speeds up approval', false),
  ('Gst', 'GST certificate', 'Optional — for GST invoices in your firm name', false),
];

/// Step 2 + status: upload KYC documents, submit, and see approval status.
class KycScreen extends ConsumerStatefulWidget {
  const KycScreen({super.key});
  @override
  ConsumerState<KycScreen> createState() => _KycState();
}

class _KycState extends ConsumerState<KycScreen> {
  String? _uploading;
  bool _submitting = false;

  Future<void> _pick(String type, String label) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Take a photo'), onTap: () => Navigator.pop(ctx, ImageSource.camera)),
        ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from gallery'), onTap: () => Navigator.pop(ctx, ImageSource.gallery)),
      ])),
    );
    if (source == null) return;
    final file = await ImagePicker().pickImage(source: source, imageQuality: 75, maxWidth: 2000);
    if (file == null || !mounted) return;

    String? number;
    if (type == 'Aadhaar' || type == 'Pan') {
      number = await showDialog<String>(context: context, builder: (ctx) {
        final ctl = TextEditingController();
        return AlertDialog(
          title: Text('$label number'),
          content: TextField(controller: ctl, autofocus: true, textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(helperText: 'Only the last 4 characters are stored')),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx, ''), child: const Text('Skip')), FilledButton(onPressed: () => Navigator.pop(ctx, ctl.text), child: const Text('OK'))],
        );
      });
    }

    setState(() => _uploading = type);
    try {
      await ref.read(kycRepoProvider).uploadDocument(type, number, file.path);
      ref.invalidate(profileProvider);
      if (mounted) toast(context, '$label uploaded');
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _uploading = null);
    }
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref.read(kycRepoProvider).submit();
      ref.invalidate(profileProvider);
      await ref.read(authProvider.notifier).refreshMe();
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(trProvider);
    final profile = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t('kyc.documents')), actions: [TextButton(onPressed: () => context.go('/home'), child: const Text('Browse products'))]),
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(profileProvider)),
        data: (p) {
          final has = {for (final d in p.documents) d.documentType: d};
          final canSubmit = has.containsKey('Aadhaar') || has.containsKey('Pan');
          return ListView(padding: const EdgeInsets.all(16), children: [
            _Steps(step: p.kycStatus == 'NotSubmitted' || p.kycStatus == 'Rejected' ? 1 : 2),
            const SizedBox(height: 16),
            _StatusBanner(p),
            const SizedBox(height: 16),
            for (final (type, label, hint, primary) in _docTypes)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: Icon(has.containsKey(type) ? Icons.check_circle : primary ? Icons.badge_outlined : Icons.add_a_photo_outlined,
                      color: has.containsKey(type) ? BM.leaf : BM.pipe),
                  title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(has[type]?.documentNumberMasked ?? (has.containsKey(type) ? 'Uploaded' : hint)),
                  trailing: _uploading == type
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : p.approved ? null : Text(has.containsKey(type) ? 'Replace' : 'Upload', style: const TextStyle(color: BM.pipe, fontWeight: FontWeight.w700)),
                  onTap: p.approved || _uploading != null ? null : () => _pick(type, label),
                ),
              ),
            const SizedBox(height: 12),
            if (p.kycStatus == 'NotSubmitted' || p.kycStatus == 'Rejected')
              FilledButton(onPressed: !canSubmit || _submitting ? null : _submit, child: Text(_submitting ? '…' : t('kyc.submit'))),
            if (p.approved) FilledButton(onPressed: () => context.go('/home'), child: const Text('Start ordering')),
            const SizedBox(height: 8),
            TextButton(onPressed: () => context.push('/profile'), child: const Text('Edit my details')),
            const SizedBox(height: 8),
            const Text('Your documents are stored privately and only seen by the store team approving partners.',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: BM.inkFaint)),
          ]);
        },
      ),
    );
  }
}

class _StatusBanner extends ConsumerWidget {
  const _StatusBanner(this.p);
  final PartnerProfile p;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    final (bg, fg, icon, title, body) = switch (p.kycStatus) {
      'Pending' => (BM.tapeLight, const Color(0xFF8A6400), Icons.hourglass_top, t('kyc.pending'), t('kyc.pendingBody')),
      'Approved' => (BM.leafLight, BM.leaf, Icons.verified, t('kyc.approved'), 'Partner prices and reward points are active.'),
      'Rejected' => (const Color(0xFFFDEEEC), BM.brick, Icons.error_outline, t('kyc.rejected'), p.kycRemarks ?? 'Please update your documents and submit again.'),
      _ => (BM.pipeLight, BM.pipe, Icons.upload_file, 'Upload Aadhaar or PAN', 'Then tap “Submit for approval”.'),
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: fg),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: fg)),
          const SizedBox(height: 2),
          Text(body, style: const TextStyle(color: BM.ink)),
        ])),
      ]),
    );
  }
}
