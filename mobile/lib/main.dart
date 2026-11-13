import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'core/constants/app_constants.dart';
import 'core/routes/app_router.dart';
import 'core/routes/app_routes.dart';
import 'core/state/catalog_controller.dart';
import 'core/state/delivery_controller.dart';
import 'core/state/cart_controller.dart';
import 'core/state/location_controller.dart';
import 'core/state/order_history_controller.dart';
import 'core/state/profile_controller.dart';
import 'core/state/quotation_controller.dart';
import 'core/state/recently_viewed_controller.dart';
import 'core/state/reward_controller.dart';
import 'core/state/session_controller.dart';
import 'core/state/wishlist_controller.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'features/rewards/data/in_memory_reward_repository.dart';
import 'services/auth_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: AppColors.background,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  await PhoneAuthService.initialize();
  final sessionController = SessionController();
  await sessionController.restore();

  runApp(BuildMateApp(sessionController: sessionController));
}

class BuildMateApp extends StatelessWidget {
  const BuildMateApp({super.key, required this.sessionController});

  final SessionController sessionController;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: sessionController),
        ChangeNotifierProvider(
          create: (_) {
            final controller = CatalogController();
            controller.startPipeCatalogSync();
            return controller;
          },
        ),
        ChangeNotifierProvider(create: (_) => CartController()),
        ChangeNotifierProvider(create: (_) => WishlistController()),
        ChangeNotifierProvider(create: (_) => RecentlyViewedController()),
        ChangeNotifierProvider(create: (_) => QuotationController()),
        ChangeNotifierProvider(create: (_) => ProfileController()),
        ChangeNotifierProvider(create: (_) => OrderHistoryController()),
        ChangeNotifierProvider(create: (_) => LocationController()),
        ChangeNotifierProvider(create: (_) => DeliveryController()),
        ChangeNotifierProvider(
          create: (context) => RewardController(
            quotationController: context.read<QuotationController>(),
            repository: InMemoryRewardRepository(),
          ),
        ),
      ],
      child: MaterialApp(
        title: AppConstants.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        initialRoute: AppRoutes.splash,
        onGenerateRoute: AppRouter.onGenerateRoute,
      ),
    );
  }
}
