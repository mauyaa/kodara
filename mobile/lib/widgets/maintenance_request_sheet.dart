import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/tenant_providers.dart';
import '../services/api_exception.dart';
import '../theme/kodara_theme.dart';

const List<String> maintenanceCategories = [
  'Plumbing',
  'Electrical',
  'Security',
  'Appliance',
  'General',
];

const List<String> maintenancePriorities = ['low', 'medium', 'high', 'emergency'];

Future<void> showMaintenanceRequestSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(KodaraRadius.xl)),
    ),
    builder: (_) => const _MaintenanceRequestForm(),
  );
}

class _MaintenanceRequestForm extends ConsumerStatefulWidget {
  const _MaintenanceRequestForm();

  @override
  ConsumerState<_MaintenanceRequestForm> createState() => _MaintenanceRequestFormState();
}

class _MaintenanceRequestFormState extends ConsumerState<_MaintenanceRequestForm> {
  final _descriptionController = TextEditingController();
  String _category = maintenanceCategories.first;
  String _priority = 'medium';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final description = _descriptionController.text.trim();
    if (description.length < 10) {
      setState(() => _error = 'Please describe the issue in at least 10 characters.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(tenantMaintenanceProvider.notifier).submit(
            category: _category,
            title: '$_category issue',
            description: description,
            priority: _priority,
          );
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Request sent to your property manager')),
        );
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Could not submit your request. Please try again.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: KodaraSpacing.space5,
          right: KodaraSpacing.space5,
          top: KodaraSpacing.space5,
          bottom: MediaQuery.of(context).viewInsets.bottom + KodaraSpacing.space5,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Report a problem',
                    style: TextStyle(fontSize: KodaraTypography.xl, fontWeight: FontWeight.w600),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: KodaraSpacing.space2),
            const Text('Category', style: TextStyle(fontWeight: FontWeight.w600, fontSize: KodaraTypography.sm)),
            const SizedBox(height: KodaraSpacing.space2),
            DropdownButtonFormField<String>(
              value: _category,
              items: maintenanceCategories
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                  .toList(),
              onChanged: (value) => setState(() => _category = value ?? _category),
            ),
            const SizedBox(height: KodaraSpacing.space4),
            const Text('Priority', style: TextStyle(fontWeight: FontWeight.w600, fontSize: KodaraTypography.sm)),
            const SizedBox(height: KodaraSpacing.space2),
            SegmentedButton<String>(
              segments: maintenancePriorities
                  .map((p) => ButtonSegment(value: p, label: Text(_titleCase(p))))
                  .toList(),
              selected: {_priority},
              onSelectionChanged: (value) => setState(() => _priority = value.first),
            ),
            const SizedBox(height: KodaraSpacing.space4),
            const Text('What happened?', style: TextStyle(fontWeight: FontWeight.w600, fontSize: KodaraTypography.sm)),
            const SizedBox(height: KodaraSpacing.space2),
            TextField(
              controller: _descriptionController,
              minLines: 3,
              maxLines: 5,
              decoration: const InputDecoration(
                hintText: 'Describe the issue and where it is…',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: KodaraSpacing.space3),
              Text(
                _error!,
                style: const TextStyle(color: KodaraColors.error, fontSize: KodaraTypography.sm),
              ),
            ],
            const SizedBox(height: KodaraSpacing.space4),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? 'Submitting…' : 'Submit request'),
            ),
          ],
        ),
      ),
    );
  }
}
