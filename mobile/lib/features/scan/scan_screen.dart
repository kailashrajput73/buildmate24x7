import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/scan_code.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../widgets/common.dart';

/// Scan tab. The camera only runs while the full-screen scanner is open (it's a tab in an IndexedStack).
class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});
  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = ref.watch(trProvider);
    return Scaffold(
      appBar: AppBar(title: Text(t('scan.title'))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const SizedBox(height: 12),
        const Icon(Icons.qr_code_2, size: 120, color: BM.pipe),
        const SizedBox(height: 12),
        Text(t('scan.hint'), textAlign: TextAlign.center, style: const TextStyle(color: BM.inkSoft)),
        const SizedBox(height: 24),
        FilledButton.icon(
          icon: const Icon(Icons.qr_code_scanner),
          label: const Text('Open scanner'),
          onPressed: () => Navigator.of(context).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => const ScannerPage())),
        ),
        const SizedBox(height: 32),
        const Text('Or type the code printed under the QR', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: TextField(controller: _code, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'BM000123'))),
          const SizedBox(width: 8),
          OutlinedButton(onPressed: () => _code.text.trim().isEmpty ? null : showScannedProduct(context, ref, _code.text.trim()), child: const Text('Find')),
        ]),
      ]),
    );
  }
}

class ScannerPage extends ConsumerStatefulWidget {
  const ScannerPage({super.key});
  @override
  ConsumerState<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends ConsumerState<ScannerPage> with WidgetsBindingObserver {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode, BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.code128, BarcodeFormat.upcA],
  );
  bool _handling = false;
  bool _torch = false;

  Future<void> _gallery() async {
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (file == null || !mounted) return;
      final capture = await _controller.analyzeImage(file.path);
      if (!mounted) return;
      if (capture == null || capture.barcodes.isEmpty) { toast(context, 'No readable product QR found. Try a clearer photo.', error: true); return; }
      await _onDetect(capture);
    } catch (_) { if (mounted) toast(context, 'Could not read this image. Try another photo.', error: true); }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) async {
    if (!_controller.value.hasCameraPermission) return;
    try {
      if (state == AppLifecycleState.resumed && !_handling) { await _controller.start(); }
      else if (state != AppLifecycleState.resumed) { await _controller.stop(); }
    } catch (_) { /* Camera view offers retry if the OS cannot resume it. */ }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null || _handling) return;
    _handling = true;
    try {
      await _controller.stop();
      if (mounted) await showScannedProduct(context, ref, code);
    } catch (_) {
      if (mounted) toast(context, 'Could not complete this scan. Please retry.', error: true);
    } finally {
      _handling = false;
      if (mounted) {
        try { await _controller.start(); } catch (_) { /* The camera error view provides retry/settings. */ }
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: const Text('Scan products'),
          actions: [
            IconButton(tooltip: _torch ? 'Turn torch off' : 'Turn torch on', onPressed: () async { await _controller.toggleTorch(); if (mounted) setState(() => _torch = !_torch); }, icon: Icon(_torch ? Icons.flashlight_on : Icons.flashlight_off_outlined)),
            IconButton(tooltip: 'Scan from gallery', onPressed: _gallery, icon: const Icon(Icons.photo_library_outlined)),
            IconButton(tooltip: 'Go to cart', onPressed: () { Navigator.of(context).pop(); context.push('/cart'); }, icon: const Icon(Icons.shopping_cart_outlined)),
          ],
        ),
        body: Stack(children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error, child) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Text('Camera access is needed to scan product codes. Allow it in app settings, or choose a gallery photo or type the code.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white)),
                  TextButton(onPressed: () => Geolocator.openAppSettings(), child: const Text('Open app settings')),
                  TextButton(onPressed: () => _controller.start(), child: const Text('Retry camera')),
                ]),
              ),
            ),
          ),
          Center(
            child: Container(
              width: 250, height: 250,
              decoration: BoxDecoration(border: Border.all(color: BM.tape, width: 3), borderRadius: BorderRadius.circular(16)),
            ),
          ),
          const Positioned(
            left: 24, right: 24, bottom: 40,
            child: Text('Keep scanning to add more items. Tap the cart when done.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white)),
          ),
        ]),
      );
}

/// Looks up a scanned / typed code and shows a sheet to add it to the cart.
Future<void> showScannedProduct(BuildContext context, WidgetRef ref, String code) async {
  final parsed = parseProductCode(code);
  if (parsed == null) { toast(context, 'This is not a product code. Scan a BuildMate product QR.', error: true); return; }
  code = parsed;
  ProductDetail d;
  try {
    d = ProductDetail.fromJson(await ref.read(apiProvider).get<Json>('/api/catalog/scan/${Uri.encodeComponent(code)}'));
  } on ApiException catch (e) {
    if (context.mounted) toast(context, e.status == 404 ? 'Product not found or unavailable in the app: $code' : e.status == 0 ? 'Network problem. Check your connection and retry.' : e.message, error: true);
    return;
  }
  if (!context.mounted) return;
  HapticFeedback.selectionClick();
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => _ScannedSheet(d),
  );
}

class _ScannedSheet extends ConsumerStatefulWidget {
  const _ScannedSheet(this.d);
  final ProductDetail d;
  @override
  ConsumerState<_ScannedSheet> createState() => _ScannedSheetState();
}

class _ScannedSheetState extends ConsumerState<_ScannedSheet> {
  double _q = 1;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final p = widget.d.card;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            ClipRRect(borderRadius: BorderRadius.circular(10), child: SizedBox(width: 72, height: 72, child: NetImage(p.imageUrl))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.brandName, style: const TextStyle(color: BM.pipe, fontWeight: FontWeight.w700, fontSize: 12)),
              Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              Text('${money(p.price)} / ${p.unit}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
              if ((p.rewardPoints ?? 0) > 0) Text('+${qty(p.rewardPoints)} pts each', style: const TextStyle(color: BM.leaf, fontSize: 12, fontWeight: FontWeight.w700)),
            ])),
          ]),
          const SizedBox(height: 16),
          if (widget.d.maxOrderQty <= 0)
            const Text('Out of stock right now.', style: TextStyle(color: BM.brick, fontWeight: FontWeight.w700))
          else
            Row(children: [
              QtyStepper(value: _q, max: widget.d.maxOrderQty, onChanged: (v) => setState(() => _q = v)),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _busy ? null : () async {
                    setState(() => _busy = true);
                    final ok = await addToCart(context, ref, p.id, _q, p.name);
                    if (ok && context.mounted) Navigator.of(context).pop();
                    if (mounted) setState(() => _busy = false);
                  },
                  child: Text('Add · ${money(p.price * _q)}'),
                ),
              ),
            ]),
        ]),
      ),
    );
  }
}
