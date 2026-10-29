import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/i18n.dart';
import '../../core/glass.dart';
import '../../core/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';
import '../cart/checkout_screen.dart' show showAddressSheet;

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ref.watch(trProvider);
    final lang = ref.watch(langProvider);
    final auth = ref.watch(authProvider);
    final user = auth.user;
    final isPartner = user?.userType == 'Partner';
    final p = isPartner ? ref.watch(profileProvider).valueOrNull : null;
    final store = ref.watch(storeInfoProvider).valueOrNull;

    if (auth.status != AuthStatus.loggedIn) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(backgroundColor: AppColors.surface, title: const Text('Profile')),
        body: EmptyView(
          icon: Icons.person_outline_rounded,
          title: 'Log in to see your orders and quotations',
          body: 'Customers and trade partners use the same app. Partners get partner prices and reward points after KYC.',
          action: FilledButton(onPressed: () => context.push('/login?next=/account'), child: const Text('Log in or sign up')),
        ),
      );
    }

    Future<void> confirmDelete() async {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(t('account.delete')),
          content: const Text('Your name, phone, addresses and KYC documents are removed. Invoices are kept as required by GST law. This cannot be undone.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep account')),
            FilledButton(style: FilledButton.styleFrom(backgroundColor: BM.brick), onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
          ],
        ),
      );
      if (ok != true) return;
      try {
        await ref.read(apiProvider).delete('/api/account');
        await ref.read(authProvider.notifier).logout();
      } catch (e) {
        if (context.mounted) toast(context, e.toString(), error: true);
      }
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(backgroundColor: AppColors.surface, title: const Text('Profile')),
      body: ListView(children: [
        if (!isPartner && user != null)
          ListTile(
            contentPadding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            leading: CircleAvatar(radius: 26, backgroundColor: BM.pipeLight,
                child: Text(user.name.isNotEmpty ? user.name[0].toUpperCase() : '?', style: const TextStyle(fontWeight: FontWeight.w800, color: BM.pipe, fontSize: 20))),
            title: Text(user.name.isEmpty ? 'Customer' : user.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            subtitle: Text('+91 ${user.phone ?? ''}${user.email != null ? '\n${user.email}' : ''}'),
            trailing: IconButton(tooltip: 'Edit', icon: const Icon(Icons.edit_outlined), onPressed: () => showCustomerProfileSheet(context, ref)),
          ),
        if (p != null)
          ListTile(
            contentPadding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            leading: CircleAvatar(radius: 26, backgroundColor: BM.pipeLight,
                child: Text(p.name.isNotEmpty ? p.name[0].toUpperCase() : '?', style: const TextStyle(fontWeight: FontWeight.w800, color: BM.pipe, fontSize: 20))),
            title: Text(p.name.isEmpty ? 'Partner' : p.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            subtitle: Text('${p.partnerType} · +91 ${p.phone ?? ''}${p.managerName != null ? '\nYour manager: ${p.managerName}' : ''}'),
            trailing: p.approved ? const Icon(Icons.verified, color: BM.leaf) : TextButton(onPressed: () => context.push('/kyc'), child: const Text('Complete KYC')),
          ),
        if (p != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(children: [
              Expanded(child: _Stat(label: 'Orders', value: '${p.orderCount}')),
              const SizedBox(width: 8),
              Expanded(child: _Stat(label: 'Purchases', value: money(p.totalPurchase))),
              const SizedBox(width: 8),
              Expanded(child: _Stat(label: 'Points', value: qty(p.rewardBalance), onTap: () => context.push('/rewards'))),
            ]),
          ),
        const SizedBox(height: 8),
        _tile(Icons.receipt_long_outlined, t('orders.title'), () => context.push('/orders')),
        _tile(Icons.request_quote_outlined, 'Quotations', () => context.go('/quotations')),
        _tile(Icons.shopping_cart_outlined, 'Cart', () => context.push('/cart')),
        if (isPartner) _tile(Icons.stars_outlined, t('rewards.title'), () => context.push('/rewards')),
        _tile(Icons.location_on_outlined, t('account.addresses'), () => context.push('/addresses')),
        _tile(Icons.notifications_outlined, t('account.notifications'), () => context.push('/notifications')),
        _tile(Icons.qr_code_scanner_rounded, 'Scan a product QR', () => context.push('/scan')),
        _tile(Icons.handyman_outlined, 'Book a plumber or electrician', () => context.push('/services')),
        if (isPartner) _tile(Icons.person_outline, 'Business details', () => context.push('/profile')),
        if (isPartner) _tile(Icons.badge_outlined, 'KYC documents', () => context.push('/kyc')),
        ListTile(
          leading: const Icon(Icons.translate),
          title: Text(t('account.language')),
          trailing: SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'en', label: Text('EN')), ButtonSegment(value: 'hi', label: Text('हि'))],
            selected: {lang},
            onSelectionChanged: (s) async {
              await ref.read(langProvider.notifier).set(s.first);
              try { await ref.read(apiProvider).put('/api/account/profile', {'name': p?.name ?? user?.name ?? '', 'email': p?.email ?? user?.email, 'preferredLanguage': s.first}); } catch (_) {}
            },
          ),
        ),
        if (store != null && store.supportPhone.isNotEmpty) ...[
          _tile(Icons.call_outlined, '${t('account.help')} · ${store.supportPhone}', () => launchUrl(Uri.parse('tel:${store.supportPhone}'))),
          if (store.whatsAppNumber != null && store.whatsAppNumber!.isNotEmpty)
            _tile(Icons.chat_outlined, 'WhatsApp the store', () => launchUrl(Uri.parse('https://wa.me/91${store.whatsAppNumber}'), mode: LaunchMode.externalApplication)),
        ],
        const Divider(height: 24),
        _tile(Icons.logout, t('account.logout'), () => ref.read(authProvider.notifier).logout()),
        ListTile(
          leading: const Icon(Icons.delete_outline, color: BM.brick),
          title: Text(t('account.delete'), style: const TextStyle(color: BM.brick)),
          onTap: confirmDelete,
        ),
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text('BuildMate 24x7 v${AppConfig.appVersion} · server ${AppConfig.apiUrl}', textAlign: TextAlign.center, style: TextStyle(color: BM.inkFaint, fontSize: 12)),
        ),
      ]),
    );
  }

  Widget _tile(IconData i, String label, VoidCallback onTap) =>
      ListTile(leading: Icon(i), title: Text(label), trailing: const Icon(Icons.chevron_right), onTap: onTap);
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.onTap});
  final String label, value;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: glassDecoration(radius: 18, shadow: false),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 12, color: BM.inkSoft)),
            FittedBox(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
          ]),
        ),
      );
}

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(addressesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(ref.watch(trProvider)('account.addresses'))),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => showAddressSheet(context, ref), icon: const Icon(Icons.add), label: const Text('Add address')),
      body: list.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(addressesProvider)),
        data: (items) => items.isEmpty
            ? const EmptyView(icon: Icons.location_off_outlined, title: 'No saved addresses', body: 'Add your sites so delivery is one tap at checkout.')
            : ListView.separated(
                itemCount: items.length,
                separatorBuilder: (_, __) => const Divider(),
                itemBuilder: (_, i) {
                  final a = items[i];
                  return ListTile(
                    title: Text('${a.name}${a.isDefault ? ' · default' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${a.oneLine}\n${a.phone}'),
                    isThreeLine: true,
                    onTap: () => showAddressSheet(context, ref, existing: a),
                    trailing: IconButton(
                      tooltip: 'Remove',
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        await ref.read(apiProvider).delete('/api/account/addresses/${a.id}');
                        ref.invalidate(addressesProvider);
                      },
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});
  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsState();
}

class _NotificationsState extends ConsumerState<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() async {
      try {
        await ref.read(apiProvider).post('/api/account/notifications/read');
        ref.invalidate(unreadCountProvider);
      } catch (_) {}
    });
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(ref.watch(trProvider)('account.notifications'))),
      body: list.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(notificationsProvider)),
        data: (items) => items.isEmpty
            ? const EmptyView(icon: Icons.notifications_none, title: 'No notifications yet', body: 'Order, KYC and reward updates appear here.')
            : ListView.separated(
                itemCount: items.length,
                separatorBuilder: (_, __) => const Divider(),
                itemBuilder: (_, i) {
                  final n = items[i];
                  final orderId = n.link != null && n.link!.startsWith('order:') ? int.tryParse(n.link!.substring(6)) : null;
                  final quoteId = n.link != null && n.link!.startsWith('quote:') ? int.tryParse(n.link!.substring(6)) : null;
                  return ListTile(
                    leading: Icon(quoteId != null ? Icons.request_quote_outlined : n.link == 'kyc' ? Icons.verified_user_outlined : n.link == 'rewards' ? Icons.stars_outlined : Icons.receipt_long_outlined,
                        color: n.isRead ? BM.inkFaint : BM.pipe),
                    title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.w500 : FontWeight.w800)),
                    subtitle: Text('${n.body}\n${dateTime(n.createdAt)}'),
                    isThreeLine: true,
                    onTap: quoteId != null ? () => context.push('/quotations/$quoteId') : orderId != null ? () => context.push('/orders/$orderId') : n.link == 'kyc' ? () => context.push('/kyc') : n.link == 'rewards' ? () => context.push('/rewards') : null,
                  );
                },
              ),
      ),
    );
  }
}


/// Customers edit their name and email (partners use Business details).
Future<void> showCustomerProfileSheet(BuildContext context, WidgetRef ref) {
  final u = ref.read(authProvider).user;
  final name = TextEditingController(text: u?.name);
  final email = TextEditingController(text: u?.email);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(ctx).viewInsets.bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Your details', style: Theme.of(ctx).textTheme.titleLarge),
        const SizedBox(height: 16),
        TextField(controller: name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full name')),
        const SizedBox(height: 12),
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email (for invoices)')),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () async {
            try {
              await ref.read(apiProvider).put('/api/account/profile', {'name': name.text.trim(), 'email': email.text.trim().isEmpty ? null : email.text.trim(), 'preferredLanguage': ref.read(langProvider)});
              await ref.read(authProvider.notifier).refreshMe();
              if (ctx.mounted) Navigator.pop(ctx);
            } catch (e) {
              if (ctx.mounted) toast(ctx, e.toString(), error: true);
            }
          },
          child: const Text('Save'),
        ),
      ]),
    ),
  );
}
