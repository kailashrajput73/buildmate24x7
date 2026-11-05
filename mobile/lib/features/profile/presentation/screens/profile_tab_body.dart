import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../../core/routes/app_routes.dart';
import '../../../../core/state/cart_controller.dart';
import '../../../../core/state/order_history_controller.dart';
import '../../../../core/state/profile_controller.dart';
import '../../../../core/state/recently_viewed_controller.dart';
import '../../../../core/state/reward_controller.dart';
import '../../../../core/state/session_controller.dart';
import '../../../../core/state/wishlist_controller.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../catalog/domain/models/catalog_models.dart';
import '../../domain/models/profile_models.dart';
import '../../utils/referral_share.dart';
import '../widgets/profile_document_preview.dart';
import '../widgets/profile_edit_sheets.dart';
import '../widgets/profile_widgets.dart';

/// Profile tab content inside [MainShell] (no nested Scaffold).
///
/// Shows personal info plus PAN / GST / Bank KYC sections. Tapping a section
/// opens its edit sheet; approved sections are locked.
class ProfileTabBody extends StatefulWidget {
  const ProfileTabBody({super.key, this.showBackButton = false});

  /// True when pushed as the standalone [AppRoutes.profile] route.
  final bool showBackButton;

  @override
  State<ProfileTabBody> createState() => _ProfileTabBodyState();
}

class _ProfileTabBodyState extends State<ProfileTabBody> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  bool _isRealUser(SessionController session) {
    final user = session.user;
    return session.isLoggedIn && !user.isGuest && user.id != 'guest';
  }

  Future<void> _load() async {
    final session = context.read<SessionController>();
    if (!_isRealUser(session)) return;
    final user = session.user;
    await Future.wait([
      context.read<RewardController>().refreshForUser(user.id),
      context.read<ProfileController>().loadForUser(user),
      context.read<OrderHistoryController>().loadForUser(user.id),
    ]);
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  void _showLocked(String section) {
    _showSnack('$section are approved and can no longer be changed.');
  }

  Future<void> _editPersonal(PersonalInfo info) async {
    final saved = await showPersonalInfoEditSheet(context, info);
    if (saved == null || !mounted) return;
    await context.read<ProfileController>().savePersonal(saved);
    if (!mounted) return;
    // Keep the session (header avatar, initials) in sync with the new name.
    final session = context.read<SessionController>();
    final u = session.user;
    await session.setUser(
      AppUserProfile(
        id: u.id,
        name: saved.fullName,
        email: saved.email,
        phone: u.phone,
        businessName: u.businessName,
        isGuest: u.isGuest,
      ),
    );
    _showSnack('Personal information updated');
  }

  Future<void> _editPan(PanDetails pan) async {
    if (pan.status?.isLocked == true) return _showLocked('PAN details');
    final saved = await showPanEditSheet(context, pan);
    if (saved == null || !mounted) return;
    await context.read<ProfileController>().savePan(
          panNumber: saved.panNumber,
          nameOnDocument: saved.nameOnDocument,
          document: saved.document,
        );
    _showSnack('PAN details submitted for approval');
  }

  Future<void> _editGst(GstDetails gst) async {
    if (gst.status?.isLocked == true) return _showLocked('GST details');
    final saved = await showGstEditSheet(context, gst);
    if (saved == null || !mounted) return;
    await context.read<ProfileController>().saveGst(
          gstNumber: saved.gstNumber,
          nameOnDocument: saved.nameOnDocument,
          document: saved.document,
        );
    _showSnack('GST details submitted for approval');
  }

  Future<void> _editBank(BankDetails bank) async {
    if (bank.status?.isLocked == true) return _showLocked('Bank details');
    final saved = await showBankEditSheet(context, bank);
    if (saved == null || !mounted) return;
    await context.read<ProfileController>().saveBank(
          accountNumber: saved.accountNumber,
          ifscCode: saved.ifscCode,
          nameOnAccount: saved.nameOnAccount,
          document: saved.document,
        );
    _showSnack('Bank details submitted for approval');
  }

  Future<void> _signOut() async {
    context.read<ProfileController>().clear();
    context.read<OrderHistoryController>().clear();
    context.read<CartController>().clear();
    context.read<WishlistController>().clear();
    context.read<RecentlyViewedController>().clear();
    await context.read<SessionController>().logout();
    if (!mounted) return;
    // Use the root navigator — the shell's nested Navigator remaps login
    // back to home tabs and would leave the user signed in visually.
    Navigator.of(context, rootNavigator: true).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (_) => false,
    );
  }

  String _referralCodeFor(AppUserProfile user) {
    final raw = (user.id.isNotEmpty ? user.id : user.name)
        .replaceAll(RegExp(r'[^A-Za-z0-9]'), '')
        .toUpperCase();
    if (raw.length >= 8) return raw.substring(0, 8);
    if (raw.isEmpty) return 'NOVA7F3K';
    return 'NOVA${raw.padRight(4, 'X').substring(0, 4)}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final session = context.watch<SessionController>();
    if (!_isRealUser(session)) {
      return ColoredBox(
        color: AppColors.background,
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.space6),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.person_outline_rounded,
                    size: 64,
                    color: AppColors.primary.withValues(alpha: 0.7),
                  ),
                  const SizedBox(height: AppSpacing.space4),
                  Text(
                    'Sign in to view your profile',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.space2),
                  Text(
                    'Use your mobile number and OTP to access account details.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.space6),
                  FilledButton(
                    onPressed: () => Navigator.of(
                      context,
                      rootNavigator: true,
                    ).pushNamedAndRemoveUntil(AppRoutes.login, (_) => false),
                    child: const Text('Sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final user = session.user;
    final details = context.watch<ProfileController>().details;
    final orderHistory = context.watch<OrderHistoryController>().orders;
    final balance = context.watch<RewardController>().balance;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: ColoredBox(
        color: AppColors.background,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: ProfileHeader(
                initials: user.initials,
                showBackButton: widget.showBackButton,
                onAvatarTap: () =>
                    _showSnack('Profile photo upload is coming soon'),
              ),
            ),
            if (details == null)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.space4,
                  AppSpacing.space4,
                  AppSpacing.space4,
                  AppSpacing.space8,
                ),
                sliver: SliverList.list(
                  children: [
                    if (details.hasPendingApproval) ...[
                      const ProfileApprovalBanner(),
                      const SizedBox(height: AppSpacing.space3),
                    ],
                    ProfileSectionCard(
                      icon: Icons.person_rounded,
                      title: 'Personal Information',
                      onTap: () => _editPersonal(details.personal),
                      children: [
                        ProfileInfoRow(
                          label: 'Full Name',
                          value: details.personal.fullName,
                        ),
                        ProfileInfoRow(
                          label: 'Mobile Number',
                          value: details.personal.mobileNumber,
                          trailing: const NotEditableChip(),
                        ),
                        ProfileInfoRow(
                          label: 'Email Address',
                          value: details.personal.email,
                        ),
                        ProfileInfoRow(
                          label: 'Address',
                          value: details.personal.address,
                        ),
                      ],
                    ),
                    ProfileSectionCard(
                      icon: Icons.description_rounded,
                      title: 'PAN Details',
                      status: details.pan.status,
                      onTap: () => _editPan(details.pan),
                      children: [
                        ProfileInfoRow(
                          label: 'PAN Number',
                          value: details.pan.panNumber,
                        ),
                        ProfileInfoRow(
                          label: 'Name on Document',
                          value: details.pan.nameOnDocument,
                        ),
                        ProfileDocumentRow(
                          document: details.pan.document,
                          onView: details.pan.document == null
                              ? null
                              : () => showProfileDocument(
                                    context,
                                    details.pan.document!,
                                  ),
                        ),
                      ],
                    ),
                    ProfileSectionCard(
                      icon: Icons.description_rounded,
                      title: 'GST Details',
                      status: details.gst.status,
                      onTap: () => _editGst(details.gst),
                      children: [
                        ProfileInfoRow(
                          label: 'GST Number',
                          value: details.gst.gstNumber,
                        ),
                        ProfileInfoRow(
                          label: 'Name on Document',
                          value: details.gst.nameOnDocument,
                        ),
                        ProfileDocumentRow(
                          document: details.gst.document,
                          onView: details.gst.document == null
                              ? null
                              : () => showProfileDocument(
                                    context,
                                    details.gst.document!,
                                  ),
                        ),
                      ],
                    ),
                    ProfileSectionCard(
                      icon: Icons.account_balance_rounded,
                      title: 'Bank Details',
                      status: details.bank.status,
                      onTap: () => _editBank(details.bank),
                      children: [
                        ProfileInfoRow(
                          label: 'Account Number',
                          value: details.bank.accountNumber,
                        ),
                        ProfileInfoRow(
                          label: 'IFSC Code',
                          value: details.bank.ifscCode,
                        ),
                        ProfileInfoRow(
                          label: 'Name on Account',
                          value: details.bank.nameOnAccount,
                        ),
                        ProfileDocumentRow(
                          document: details.bank.document,
                          onView: details.bank.document == null
                              ? null
                              : () => showProfileDocument(
                                    context,
                                    details.bank.document!,
                                  ),
                        ),
                      ],
                    ),
                    ProfileOrderHistorySection(orders: orderHistory),
                    const SizedBox(height: AppSpacing.space2),
                    Padding(
                      padding: const EdgeInsets.only(
                        left: AppSpacing.space1,
                        bottom: AppSpacing.space2,
                      ),
                      child: Text('Account', style: theme.textTheme.titleSmall),
                    ),
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: _AccountMiniTile(
                              icon: Icons.stars_rounded,
                              title: 'My Rewards',
                              subtitle: '$balance points',
                              onTap: () {
                                Navigator.of(context)
                                    .pushNamed(AppRoutes.myRewards);
                              },
                            ),
                          ),
                          const SizedBox(width: AppSpacing.space2),
                          Expanded(
                            child: _EarnReferCard(
                              referralCode: _referralCodeFor(user),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    OutlinedButton.icon(
                      onPressed: () => _signOut(),
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Sign out'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
class _AccountMiniTile extends StatelessWidget {
  const _AccountMiniTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.mdAll,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.space3),
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: AppColors.divider),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: AppColors.primary, size: 20),
              const SizedBox(height: AppSpacing.space2),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              ),
              const Spacer(),
              Align(
                alignment: Alignment.centerRight,
                child: Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.onSurfaceVariant.withValues(alpha: 0.7),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EarnReferCard extends StatelessWidget {
  const _EarnReferCard({required this.referralCode});

  final String referralCode;

  Future<void> _copyCode(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: referralCode));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Referral code copied'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _shareCode(BuildContext context) async {
    await shareReferralCode(referralCode);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.mdAll,
      clipBehavior: Clip.antiAlias,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.space3),
        decoration: BoxDecoration(
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: AppColors.divider),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.card_giftcard_rounded,
                  color: AppColors.primary,
                  size: 20,
                ),
                const Spacer(),
                InkWell(
                  onTap: () => _shareCode(context),
                  borderRadius: AppRadius.pillAll,
                  child: const Padding(
                    padding: EdgeInsets.all(2),
                    child: Icon(
                      Icons.share_rounded,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space2),
            Text(
              'Earn & Refer',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Share code & earn rewards',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space2,
                vertical: AppSpacing.space1,
              ),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: AppRadius.smAll,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      referralCode,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                      ),
                    ),
                  ),
                  InkWell(
                    onTap: () => _copyCode(context),
                    borderRadius: AppRadius.smAll,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 2,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.copy_rounded,
                            size: 14,
                            color: AppColors.primary,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            'Copy',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
