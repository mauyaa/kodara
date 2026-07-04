import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../providers/providers.dart';
import '../services/api_exception.dart';
import '../services/kodara_service.dart';
import '../theme/kodara_theme.dart';

/// Maintenance submission with optional photos (kodara.md DoD #6). Photos
/// upload to the private maintenance-photos bucket under the tenancy's
/// folder; a failed upload surfaces a retryable error instead of silently
/// submitting without the photo.
class MaintenanceRequestSheet extends ConsumerStatefulWidget {
  const MaintenanceRequestSheet({super.key, required this.tenancyId});

  final String tenancyId;

  static Future<bool?> show(BuildContext context,
          {required String tenancyId}) =>
      showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: MaintenanceRequestSheet(tenancyId: tenancyId),
        ),
      );

  @override
  ConsumerState<MaintenanceRequestSheet> createState() =>
      _MaintenanceRequestSheetState();
}

class _MaintenanceRequestSheetState
    extends ConsumerState<MaintenanceRequestSheet> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _picker = ImagePicker();

  String _priority = 'normal';
  final List<XFile> _photos = [];
  bool _busy = false;
  String? _error;

  static const _priorities = [
    ('low', 'Low'),
    ('normal', 'Normal'),
    ('high', 'High'),
    ('emergency', 'Emergency'),
  ];

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      imageQuality: 80,
    );
    if (picked != null && mounted) setState(() => _photos.add(picked));
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final uploads = <PhotoUpload>[];
      for (final photo in _photos) {
        uploads.add(PhotoUpload(
          fileName: photo.name,
          bytes: await photo.readAsBytes(),
          contentType: photo.mimeType ?? 'image/jpeg',
        ));
      }
      await ref.read(kodaraServiceProvider).createMaintenanceRequest(
            tenancyId: widget.tenancyId,
            title: _title.text.trim(),
            description: _description.text.trim(),
            priority: _priority,
            photos: uploads,
          );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(KodaraSpacing.space5),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Report an issue',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: KodaraSpacing.space4),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(KodaraSpacing.space3),
                decoration: BoxDecoration(
                  color: KodaraColors.errorTint,
                  borderRadius: BorderRadius.circular(KodaraRadius.md),
                ),
                child: Text(_error!,
                    style: const TextStyle(color: KodaraColors.error)),
              ),
              const SizedBox(height: KodaraSpacing.space4),
            ],
            TextFormField(
              controller: _title,
              decoration: const InputDecoration(
                labelText: 'What is the problem?',
                hintText: 'e.g. Kitchen tap is leaking',
              ),
              maxLength: 120,
              validator: (v) => (v == null || v.trim().length < 3)
                  ? 'At least 3 characters'
                  : null,
            ),
            TextFormField(
              controller: _description,
              decoration: const InputDecoration(
                labelText: 'Describe it',
                hintText: 'When did it start? How bad is it?',
              ),
              minLines: 3,
              maxLines: 6,
              maxLength: 2000,
              validator: (v) => (v == null || v.trim().length < 10)
                  ? 'At least 10 characters'
                  : null,
            ),
            const SizedBox(height: KodaraSpacing.space3),
            DropdownButtonFormField<String>(
              initialValue: _priority,
              decoration: const InputDecoration(labelText: 'Priority'),
              items: [
                for (final (value, label) in _priorities)
                  DropdownMenuItem(value: value, child: Text(label)),
              ],
              onChanged: (v) => setState(() => _priority = v ?? 'normal'),
            ),
            const SizedBox(height: KodaraSpacing.space4),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _busy ? null : _pickPhoto,
                  icon: const Icon(Icons.add_a_photo_rounded, size: 18),
                  label: const Text('Add photo'),
                ),
                const SizedBox(width: KodaraSpacing.space3),
                if (_photos.isNotEmpty)
                  Text('${_photos.length} photo(s) attached',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: KodaraColors.textSecondary)),
              ],
            ),
            const SizedBox(height: KodaraSpacing.space5),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Submit request'),
            ),
          ],
        ),
      ),
    );
  }
}
