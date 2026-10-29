import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

/// A plumber / electrician visit request (GET/POST /api/service-requests).
class ServiceRequest {
  ServiceRequest.fromJson(Json j)
      : id = (j['id'] as num).toInt(),
        requestNo = j['requestNo'] as String,
        createdAt = j['createdAt'] as String,
        serviceType = j['serviceType'] as String,
        description = j['description'] as String,
        status = j['status'] as String,
        preferredAt = j['preferredAt'] as String?,
        assignedPartnerName = j['assignedPartnerName'] as String?,
        assignedPartnerPhone = j['assignedPartnerPhone'] as String?;
  final int id;
  final String requestNo, createdAt, serviceType, description, status;
  final String? preferredAt, assignedPartnerName, assignedPartnerPhone;
}

final serviceRequestsProvider = FutureProvider.autoDispose<List<ServiceRequest>>((ref) async {
  final list = await ref.read(apiProvider).get<List<dynamic>>('/api/service-requests');
  return list.map((e) => ServiceRequest.fromJson(e as Json)).toList();
});

const _statusLabel = {'Pending': 'Received', 'InProgress': 'Technician assigned', 'Completed': 'Completed', 'Cancelled': 'Cancelled'};

/// "Need a plumber or electrician?" — the customer's requests and a button to ask for a new visit.
class ServiceRequestsScreen extends ConsumerWidget {
  const ServiceRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final res = ref.watch(serviceRequestsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Plumber & electrician')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final ok = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, builder: (_) => const _NewRequestSheet());
          if (ok == true) ref.invalidate(serviceRequestsProvider);
        },
        icon: const Icon(Icons.add),
        label: const Text('Request a visit'),
      ),
      body: res.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(e, onRetry: () => ref.invalidate(serviceRequestsProvider)),
        data: (list) => list.isEmpty
            ? const EmptyView(
                icon: Icons.handyman_outlined,
                title: 'Need a plumber or electrician?',
                body: 'Tell us the work and when suits you. The store sends a trusted technician from its partner network.',
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(AppSpacing.space4, AppSpacing.space4, AppSpacing.space4, 96),
                itemCount: list.length,
                separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.space3),
                itemBuilder: (_, i) {
                  final r = list[i];
                  return Container(
                    padding: const EdgeInsets.all(AppSpacing.space4),
                    decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadius.mdAll, border: Border.all(color: AppColors.divider)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Icon(r.serviceType == 'Plumber' ? Icons.plumbing_rounded : Icons.electrical_services_rounded, color: AppColors.primary),
                        const SizedBox(width: AppSpacing.space2),
                        Expanded(child: Text('${r.serviceType} · ${r.requestNo}', style: theme.textTheme.titleSmall)),
                        Text(_statusLabel[r.status] ?? r.status,
                            style: theme.textTheme.labelMedium?.copyWith(color: r.status == 'Completed' ? AppColors.success : AppColors.primary, fontWeight: FontWeight.w700)),
                      ]),
                      const SizedBox(height: AppSpacing.space2),
                      Text(r.description, style: theme.textTheme.bodyMedium),
                      const SizedBox(height: AppSpacing.space2),
                      Text(r.preferredAt == null ? 'Any time · asked ${dateTime(r.createdAt)}' : 'Preferred ${dateTime(r.preferredAt)}',
                          style: theme.textTheme.bodySmall?.copyWith(color: AppColors.outline)),
                      if (r.assignedPartnerName != null)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.space2),
                          child: Text('Technician: ${r.assignedPartnerName}${r.assignedPartnerPhone != null ? ' · ${r.assignedPartnerPhone}' : ''}',
                              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                        ),
                      if (r.status == 'Pending')
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () async {
                              try {
                                await ref.read(apiProvider).post<Json>('/api/service-requests/${r.id}/cancel');
                                ref.invalidate(serviceRequestsProvider);
                              } catch (e) {
                                if (context.mounted) toast(context, e.toString(), error: true);
                              }
                            },
                            child: const Text('Cancel request'),
                          ),
                        ),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}

class _NewRequestSheet extends ConsumerStatefulWidget {
  const _NewRequestSheet();
  @override
  ConsumerState<_NewRequestSheet> createState() => _NewRequestState();
}

class _NewRequestState extends ConsumerState<_NewRequestSheet> {
  final _form = GlobalKey<FormState>();
  String _type = 'Plumber';
  final _desc = TextEditingController();
  final _address = TextEditingController();
  final _pincode = TextEditingController();
  DateTime? _when;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final list = ref.read(addressesProvider).valueOrNull ?? const <Address>[];
    final a = list.where((x) => x.isDefault).firstOrNull ?? list.firstOrNull;
    if (a != null) {
      _address.text = [a.line1, a.line2, a.city].where((x) => x != null && x.isNotEmpty).join(', ');
      _pincode.text = a.pincode;
    }
  }

  @override
  void dispose() {
    _desc.dispose();
    _address.dispose();
    _pincode.dispose();
    super.dispose();
  }

  Future<void> _pickWhen() async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 30)), initialDate: now);
    if (d == null || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (t == null) return;
    setState(() => _when = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final u = ref.read(authProvider).user;
      await ref.read(apiProvider).post<Json>('/api/service-requests', {
        'serviceType': _type,
        'description': _desc.text.trim(),
        'contactName': u?.name,
        'contactPhone': u?.phone,
        'address': _address.text.trim(),
        'pincode': _pincode.text.trim(),
        'preferredAt': _when?.toUtc().toIso8601String(),
      });
      if (mounted) {
        toast(context, 'Request sent. The store will call you to confirm.');
        Navigator.pop(context, true);
      }
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(AppSpacing.space4, 0, AppSpacing.space4, AppSpacing.space4 + MediaQuery.of(context).viewInsets.bottom),
      child: Form(
        key: _form,
        child: ListView(shrinkWrap: true, children: [
          Text('Request a visit', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.space4),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'Plumber', icon: Icon(Icons.plumbing_rounded), label: Text('Plumber')),
              ButtonSegment(value: 'Electrician', icon: Icon(Icons.electrical_services_rounded), label: Text('Electrician')),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: AppSpacing.space4),
          TextFormField(
            controller: _desc,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'What needs doing?', hintText: 'e.g. Bathroom tap leaking, fit 2 new fans'),
            validator: (v) => (v ?? '').trim().length < 5 ? 'Describe the work in a few words' : null,
          ),
          const SizedBox(height: AppSpacing.space3),
          TextFormField(controller: _address, decoration: const InputDecoration(labelText: 'Address'), validator: (v) => (v ?? '').trim().isEmpty ? 'Required' : null),
          const SizedBox(height: AppSpacing.space3),
          TextFormField(
            controller: _pincode,
            keyboardType: TextInputType.number,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(labelText: 'Pincode', counterText: ''),
            validator: (v) => (v ?? '').length != 6 ? '6 digits' : null,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.schedule),
            title: const Text('Preferred time'),
            subtitle: Text(_when == null ? 'Any time' : '${_when!.day}/${_when!.month} at ${TimeOfDay.fromDateTime(_when!).format(context)}'),
            onTap: _pickWhen,
          ),
          FilledButton(onPressed: _busy ? null : _submit, child: Text(_busy ? 'Sending…' : 'Send request')),
        ]),
      ),
    );
  }
}
