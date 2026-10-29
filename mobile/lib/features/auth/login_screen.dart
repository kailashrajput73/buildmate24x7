import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_constants.dart';
import '../../core/i18n.dart';
import '../../core/phone_auth.dart';
import '../../core/theme.dart';
import '../../data/providers.dart';
import '../../widgets/auth/auth_otp_fields.dart';
import '../../widgets/auth/auth_validators.dart';
import '../../widgets/auth/login_flow_widgets.dart';
import '../../widgets/common.dart';

const _logo = 'assets/images/branding/AppLogo.png';

/// Brand splash while the saved session is checked.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashState();
}

class _SplashState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(authProvider.notifier).bootstrap());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: LoginFlowColors.backdropGradient, begin: Alignment.topCenter, end: Alignment.bottomCenter),
        ),
        child: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const LoginFlowIconBadge(imageAsset: _logo, size: 112),
            const SizedBox(height: AppSpacing.space5),
            Text(AppConstants.appName, style: theme.textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5)),
            const SizedBox(height: AppSpacing.space2),
            Text(AppConstants.taglinePrefix, style: theme.textTheme.titleMedium?.copyWith(color: AppColors.onSurfaceVariant, fontWeight: FontWeight.w400)),
            Text(AppConstants.taglineEmphasis, style: theme.textTheme.titleMedium?.copyWith(color: AppColors.primary, fontWeight: FontWeight.w700)),
          ]),
        ),
      ),
    );
  }
}

/// Login / sign-up step 1: mobile number (the kit's login screen). Browsing works without logging in.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.next});
  /// Where to go after signing in (e.g. back to checkout).
  final String? next;
  @override
  ConsumerState<LoginScreen> createState() => _LoginState();
}

class _LoginState extends ConsumerState<LoginScreen> {
  final _mobile = TextEditingController();
  bool _loading = false;
  bool _isLogin = true;

  @override
  void dispose() {
    _mobile.dispose();
    super.dispose();
  }

  bool get _canContinue => AuthValidators.mobile(_mobile.text) == null;

  Future<void> _continue() async {
    final mobile = _mobile.text.trim();
    if (!_canContinue) return;
    setState(() => _loading = true);
    try {
      await ref.read(phoneAuthProvider).send(mobile);
      if (!mounted) return;
      context.push('/login/verify', extra: OtpArgs(mobile: mobile, signUp: !_isLogin, next: widget.next));
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lang = ref.watch(langProvider);
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: LoginFlowColors.backdropGradient, begin: Alignment.topCenter, end: Alignment.bottomCenter),
        ),
        child: SafeArea(
          child: LayoutBuilder(builder: (context, constraints) {
            const padding = EdgeInsets.fromLTRB(AppSpacing.space6, AppSpacing.space4, AppSpacing.space6, AppSpacing.space6);
            final minHeight = constraints.maxHeight - padding.vertical;
            return SingleChildScrollView(
              padding: padding,
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: minHeight > 0 ? minHeight : 0),
                child: IntrinsicHeight(
                  child: Column(children: [
                    Row(children: [
                      _Pill(label: lang == 'en' ? 'हिन्दी' : 'English', onTap: () => ref.read(langProvider.notifier).set(lang == 'en' ? 'hi' : 'en')),
                      const Spacer(),
                      _Pill(label: 'Skip login', onTap: () => context.go('/home')),
                    ]),
                    const Spacer(flex: 2),
                    const Center(child: LoginFlowIconBadge(imageAsset: _logo, size: 104)),
                    const SizedBox(height: AppSpacing.space5),
                    Text(loginAppDisplayName, textAlign: TextAlign.center,
                        style: theme.textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                    const SizedBox(height: AppSpacing.space2),
                    Text(_isLogin ? 'Welcome back! Login to continue' : 'Create an account to get started', textAlign: TextAlign.center,
                        style: theme.textTheme.titleMedium?.copyWith(color: AppColors.onSurfaceVariant, fontWeight: FontWeight.w400)),
                    const SizedBox(height: AppSpacing.space8),
                    LoginFlowModeToggle(isLogin: _isLogin, onChanged: (v) => setState(() => _isLogin = v)),
                    const SizedBox(height: AppSpacing.space6),
                    Align(alignment: Alignment.centerLeft, child: Text('Mobile Number', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                    const SizedBox(height: AppSpacing.space2),
                    LoginFlowPhoneField(controller: _mobile, onChanged: (_) => setState(() {})),
                    const SizedBox(height: AppSpacing.space2),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text("We'll send a 6-digit OTP to verify this number",
                          style: theme.textTheme.bodySmall?.copyWith(color: AppColors.onSurfaceVariant)),
                    ),
                    const SizedBox(height: AppSpacing.space6),
                    LoginFlowContinueButton(label: 'Send OTP', enabled: _canContinue, loading: _loading, onPressed: _continue),
                    const Spacer(flex: 3),
                    const LoginFlowTermsFooter(),
                  ]),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.onSurfaceVariant,
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll, side: const BorderSide(color: LoginFlowColors.fieldBorder)),
          minimumSize: const Size(0, 34),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4, vertical: AppSpacing.space1),
          textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
        child: Text(label),
      );
}

class OtpArgs {
  const OtpArgs({required this.mobile, required this.signUp, this.next});
  final String mobile;
  final bool signUp;
  final String? next;
}

/// Step 2: the 6-digit code. An existing number signs straight in; a new one goes on to name and profession.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs args;
  @override
  ConsumerState<OtpScreen> createState() => _OtpState();
}

class _OtpState extends ConsumerState<OtpScreen> {
  final _otpKey = GlobalKey<AuthOtpFieldsState>();
  String _otp = '';
  String? _error;
  bool _loading = false;
  int _seconds = AppConstants.otpResendSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
    // Android can read the SMS itself; then there's nothing to type.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (ref.read(phoneAuthProvider).autoVerified != null) _verify('');
    });
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _seconds = AppConstants.otpResendSeconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _seconds = _seconds <= 1 ? 0 : _seconds - 1);
      if (_seconds == 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _verify([String? code]) async {
    final otp = code ?? _otp;
    final auto = ref.read(phoneAuthProvider).autoVerified != null;
    if (!auto && otp.length != AppConstants.otpLength) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final proof = await ref.read(phoneAuthProvider).verify(widget.args.mobile, otp);
      try {
        // Sign-up with a number that already has an account just signs in.
        await ref.read(authProvider.notifier).signIn(proof);
        if (mounted) context.go(widget.args.next ?? '/home');
      } on SignupRequired catch (s) {
        if (mounted) context.pushReplacement('/signup', extra: SignupArgs(proof: s.proof, next: widget.args.next));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
      _otpKey.currentState?.clear();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    try {
      await ref.read(phoneAuthProvider).send(widget.args.mobile);
      if (!mounted) return;
      _otpKey.currentState?.clear();
      setState(() => _error = null);
      _startTimer();
      toast(context, 'Verification code resent');
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant);
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.space6, AppSpacing.space4, AppSpacing.space6, AppSpacing.space6),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              LoginFlowBackButton(onPressed: () => context.pop()),
              Expanded(child: Text('Verify your number', textAlign: TextAlign.center, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
              const SizedBox(width: 44),
            ]),
            const SizedBox(height: AppSpacing.space10),
            const Center(child: LoginFlowOtpIcon()),
            const SizedBox(height: AppSpacing.space8),
            Text("We've sent a 6-digit code to", textAlign: TextAlign.center, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w500)),
            const SizedBox(height: AppSpacing.space1),
            Text(AuthValidators.formatMobileDisplay(widget.args.mobile), textAlign: TextAlign.center,
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: AppSpacing.space8),
            AuthOtpFields(
              key: _otpKey,
              hasError: _error != null,
              onChanged: (v) => setState(() {
                _otp = v;
                _error = null;
              }),
              onCompleted: _verify,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.space2),
              Text(_error!, textAlign: TextAlign.center, style: theme.textTheme.bodySmall?.copyWith(color: AppColors.error)),
            ],
            const SizedBox(height: AppSpacing.space3),
            Text('Tap the boxes to enter or paste your code', textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(color: AppColors.onSurfaceVariant)),
            const SizedBox(height: AppSpacing.space8),
            LoginFlowContinueButton(label: 'Verify & continue', enabled: _otp.length == AppConstants.otpLength, loading: _loading, onPressed: () => _verify()),
            const SizedBox(height: AppSpacing.space8),
            Center(
              child: Text.rich(
                TextSpan(style: muted, children: [
                  const TextSpan(text: "Didn't receive the code? "),
                  _seconds > 0
                      ? TextSpan(text: 'Resend OTP in 0:${_seconds.toString().padLeft(2, '0')}')
                      : TextSpan(
                          text: 'Resend OTP',
                          style: muted?.copyWith(color: LoginFlowColors.link, decoration: TextDecoration.underline, fontWeight: FontWeight.w600),
                          recognizer: TapGestureRecognizer()..onTap = _resend,
                        ),
                ]),
                textAlign: TextAlign.center,
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class SignupArgs {
  const SignupArgs({required this.proof, this.next, this.name = '', this.email = ''});
  final PhoneProof proof;
  final String? next;
  final String name, email;
}

/// Sign-up step 3: name (and optional email).
class CreateAccountScreen extends StatefulWidget {
  const CreateAccountScreen({super.key, required this.args});
  final SignupArgs args;
  @override
  State<CreateAccountScreen> createState() => _CreateAccountState();
}

class _CreateAccountState extends State<CreateAccountScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.args.name);
  late final _email = TextEditingController(text: widget.args.email);

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  void _continue() {
    if (!(_form.currentState?.validate() ?? false)) return;
    context.push('/signup/profession',
        extra: SignupArgs(proof: widget.args.proof, next: widget.args.next, name: _name.text.trim(), email: _email.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.space6, AppSpacing.space6, AppSpacing.space6, AppSpacing.space6),
          child: Form(
            key: _form,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                LoginFlowBackButton(onPressed: () => context.go('/login')),
                const SizedBox(width: AppSpacing.space4),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Create your account', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: AppSpacing.space2),
                    Text('${AuthValidators.formatMobileDisplay(widget.args.proof.phone)} is verified. Tell us your name.',
                        style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant)),
                  ]),
                ),
              ]),
              const SizedBox(height: AppSpacing.space8),
              LoginFlowOutlinedField(
                label: 'Full name',
                controller: _name,
                hintText: 'e.g. Rakesh Patel',
                textCapitalization: TextCapitalization.words,
                prefixIcon: Icons.person_outline,
                validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your name' : null,
              ),
              const SizedBox(height: AppSpacing.space5),
              LoginFlowOutlinedField(
                label: 'Email (optional, for invoices)',
                controller: _email,
                hintText: 'name@example.com',
                keyboardType: TextInputType.emailAddress,
                prefixIcon: Icons.mail_outline,
                textInputAction: TextInputAction.done,
                validator: (v) => (v ?? '').trim().isEmpty || RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v!.trim()) ? null : 'Enter a valid email',
              ),
              const SizedBox(height: AppSpacing.space8),
              LoginFlowContinueButton(label: 'Continue', enabled: true, onPressed: _continue),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Sign-up step 4: profession. Home Owner → customer account; trades → partner account (partner prices and
/// reward points after KYC approval).
class ProfessionScreen extends ConsumerStatefulWidget {
  const ProfessionScreen({super.key, required this.args});
  final SignupArgs args;
  @override
  ConsumerState<ProfessionScreen> createState() => _ProfessionState();
}

class _Profession {
  const _Profession(this.title, this.subtitle, this.image, this.partnerType);
  final String title, subtitle, image;
  /// null = customer (home owner).
  final String? partnerType;
}

class _ProfessionState extends ConsumerState<ProfessionScreen> {
  static const _options = [
    _Profession('Contractor', 'Building & construction', 'assets/images/professions/contractor.png', 'Contractor'),
    _Profession('Plumber', 'Pipes, bathrooms & fittings', 'assets/images/professions/plumber.png', 'Plumber'),
    _Profession('Electrician', 'Wiring, switches & lighting', 'assets/images/professions/electrician.png', 'Electrician'),
    _Profession('Flooring', 'Tiles & adhesives', 'assets/images/professions/flooring.png', 'Flooring'),
    _Profession('Home Owner', 'Buying for my own house', 'assets/images/professions/home_owner.png', null),
  ];
  int? _selected;
  bool _loading = false;

  Future<void> _continue() async {
    final i = _selected;
    if (i == null) return;
    final p = _options[i];
    setState(() => _loading = true);
    try {
      final auth = ref.read(authProvider.notifier);
      final proof = await auth.phone.refresh(widget.args.proof);
      final user = await auth.signIn(proof,
          audience: p.partnerType == null ? 'Customer' : 'Partner', name: widget.args.name, email: widget.args.email, partnerType: p.partnerType);
      if (!mounted) return;
      // New partners fill in business details and KYC next; the router sends them there.
      context.go(user.userType == 'Partner' ? '/register' : (widget.args.next ?? '/home'));
    } catch (e) {
      if (mounted) toast(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.space6, AppSpacing.space6, AppSpacing.space6, AppSpacing.space4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              LoginFlowBackButton(onPressed: () => context.pop()),
              const SizedBox(width: AppSpacing.space4),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Choose your profession', style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: AppSpacing.space2),
                  Text('Trade partners get partner prices and reward points once we verify their KYC.',
                      style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant)),
                ]),
              ),
            ]),
            const SizedBox(height: AppSpacing.space6),
            Expanded(
              child: ListView.separated(
                itemCount: _options.length,
                separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.space3),
                itemBuilder: (context, i) {
                  final o = _options[i];
                  final on = _selected == i;
                  return InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => setState(() => _selected = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space4, vertical: AppSpacing.space3),
                      decoration: BoxDecoration(
                        color: on ? LoginFlowColors.accentMuted : AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: on ? LoginFlowColors.accent : LoginFlowColors.fieldBorder, width: on ? 1.5 : 1),
                      ),
                      child: Row(children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(border: Border.all(color: LoginFlowColors.fieldBorder), borderRadius: BorderRadius.circular(10)),
                          child: ClipRRect(borderRadius: BorderRadius.circular(9), child: Image.asset(o.image, width: 48, height: 48, fit: BoxFit.cover)),
                        ),
                        const SizedBox(width: AppSpacing.space4),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(o.title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                            const SizedBox(height: AppSpacing.space1),
                            Text(o.subtitle, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.onSurfaceVariant)),
                          ]),
                        ),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: on ? LoginFlowColors.accent : Colors.transparent,
                            border: Border.all(color: on ? LoginFlowColors.accent : LoginFlowColors.fieldBorder, width: 1.5),
                          ),
                          child: on ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
                        ),
                      ]),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.space4),
            LoginFlowContinueButton(label: 'Create account', enabled: _selected != null, loading: _loading, onPressed: _continue),
          ]),
        ),
      ),
    );
  }
}
