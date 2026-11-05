import 'package:flutter/material.dart';

import '../../domain/models/category_module_kind.dart';
import 'pipes_fitting_category_screen.dart';

/// Electricals module — same live catalog UX as pipes, backed by
/// Live Electrical category data is loaded by the shared Provider catalogue.
class ElectricalsCategoryScreen extends StatelessWidget {
  const ElectricalsCategoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PipesFittingCategoryScreen(
      module: CategoryModuleKind.electricals,
    );
  }
}
