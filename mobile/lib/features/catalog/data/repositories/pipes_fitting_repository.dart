import '../../../../core/network/api_client.dart';
import '../../domain/models/pipes_fitting_catalog_models.dart';
import '../mappers/catalog_api_mapper.dart';
import 'catalog_repository.dart';

/// Loads the "Pipes & Fitting" catalog from the live API
/// (`http://…/api/catalog`), not from local mock assets.
class PipesFittingRepository {
  PipesFittingRepository({CatalogRepository? catalogRepository})
      : _catalogRepository = catalogRepository ?? CatalogRepository();

  final CatalogRepository _catalogRepository;

  Future<PipesFittingCatalog> fetchLiveCatalog() async {
    final items = await _catalogRepository.fetchPipeCatalog();
    if (items.isEmpty) {
      throw ApiException('No pipes & fitting products returned by server');
    }
    return CatalogApiMapper.toPipesFittingCatalog(items);
  }

  void dispose() => _catalogRepository.dispose();
}
