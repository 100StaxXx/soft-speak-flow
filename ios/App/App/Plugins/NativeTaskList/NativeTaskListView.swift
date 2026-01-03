import UIKit

protocol NativeTaskListViewDelegate: AnyObject {
    func taskListDidReorder(taskIds: [String])
    func taskListDidToggle(taskId: String, completed: Bool)
    func taskListDidDelete(taskId: String)
}

class NativeTaskListView: UIView {
    
    weak var delegate: NativeTaskListViewDelegate?
    
    private var sections: [(title: String, tasks: [TaskItem])] = []
    private var allTasks: [TaskItem] = []
    
    private let tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .grouped)
        table.backgroundColor = .clear
        table.separatorStyle = .none
        table.showsVerticalScrollIndicator = false
        table.translatesAutoresizingMaskIntoConstraints = false
        table.dragInteractionEnabled = true
        table.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: 20, right: 0)
        return table
    }()
    
    // MARK: - Init
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        backgroundColor = UIColor(red: 0.07, green: 0.07, blue: 0.08, alpha: 1.0) // #121214
        
        addSubview(tableView)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: topAnchor),
            tableView.leadingAnchor.constraint(equalTo: leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        
        tableView.register(TaskTableViewCell.self, forCellReuseIdentifier: TaskTableViewCell.identifier)
        tableView.dataSource = self
        tableView.delegate = self
        tableView.dragDelegate = self
        tableView.dropDelegate = self
    }
    
    // MARK: - Public Methods
    
    func updateTasks(_ tasks: [TaskItem]) {
        allTasks = tasks
        
        // Group by section
        var grouped: [String: [TaskItem]] = [
            "morning": [],
            "afternoon": [],
            "evening": [],
            "unscheduled": []
        ]
        
        for task in tasks {
            let section = task.section ?? "unscheduled"
            grouped[section, default: []].append(task)
        }
        
        sections = []
        let sectionOrder = ["morning", "afternoon", "evening", "unscheduled"]
        let sectionTitles = ["Morning", "Afternoon", "Evening", "Unscheduled"]
        
        for (index, key) in sectionOrder.enumerated() {
            if let tasks = grouped[key], !tasks.isEmpty {
                sections.append((title: sectionTitles[index], tasks: tasks))
            }
        }
        
        tableView.reloadData()
    }
    
    private func getAllTaskIds() -> [String] {
        return sections.flatMap { $0.tasks.map { $0.id } }
    }
}

// MARK: - UITableViewDataSource

extension NativeTaskListView: UITableViewDataSource {
    
    func numberOfSections(in tableView: UITableView) -> Int {
        return sections.count
    }
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return sections[section].tasks.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let cell = tableView.dequeueReusableCell(withIdentifier: TaskTableViewCell.identifier, for: indexPath) as? TaskTableViewCell else {
            return UITableViewCell()
        }
        
        let task = sections[indexPath.section].tasks[indexPath.row]
        cell.configure(with: task)
        cell.onToggle = { [weak self] taskId, _ in
            self?.delegate?.taskListDidToggle(taskId: taskId, completed: true)
        }
        
        return cell
    }
    
    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return nil // We'll use custom header
    }
    
    func tableView(_ tableView: UITableView, viewForHeaderInSection section: Int) -> UIView? {
        let headerView = UIView()
        headerView.backgroundColor = .clear
        
        let label = UILabel()
        label.text = sections[section].title.uppercased()
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        label.textColor = UIColor(white: 0.5, alpha: 1.0)
        label.translatesAutoresizingMaskIntoConstraints = false
        
        headerView.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 20),
            label.bottomAnchor.constraint(equalTo: headerView.bottomAnchor, constant: -8)
        ])
        
        return headerView
    }
    
    func tableView(_ tableView: UITableView, heightForHeaderInSection section: Int) -> CGFloat {
        return 36
    }
    
    func tableView(_ tableView: UITableView, heightForFooterInSection section: Int) -> CGFloat {
        return 8
    }
    
    func tableView(_ tableView: UITableView, viewForFooterInSection section: Int) -> UIView? {
        return UIView()
    }
}

// MARK: - UITableViewDelegate

extension NativeTaskListView: UITableViewDelegate {
    
    func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool {
        return true
    }
    
    func tableView(_ tableView: UITableView, moveRowAt sourceIndexPath: IndexPath, to destinationIndexPath: IndexPath) {
        // Move task between sections
        var task = sections[sourceIndexPath.section].tasks[sourceIndexPath.row]
        sections[sourceIndexPath.section].tasks.remove(at: sourceIndexPath.row)
        
        // Update section if moved to different section
        if sourceIndexPath.section != destinationIndexPath.section {
            let sectionOrder = ["morning", "afternoon", "evening", "unscheduled"]
            let newSectionKey = sectionOrder[destinationIndexPath.section]
            task = TaskItem(from: [
                "id": task.id,
                "task_text": task.task_text,
                "completed": task.completed,
                "xp_reward": task.xp_reward,
                "difficulty": task.difficulty as Any,
                "category": task.category as Any,
                "scheduled_time": task.scheduled_time as Any,
                "is_main_quest": task.is_main_quest,
                "section": newSectionKey
            ])
        }
        
        sections[destinationIndexPath.section].tasks.insert(task, at: destinationIndexPath.row)
        
        // Notify delegate
        delegate?.taskListDidReorder(taskIds: getAllTaskIds())
    }
    
    func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let deleteAction = UIContextualAction(style: .destructive, title: nil) { [weak self] _, _, completion in
            guard let self = self else { return }
            let task = self.sections[indexPath.section].tasks[indexPath.row]
            
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            
            self.sections[indexPath.section].tasks.remove(at: indexPath.row)
            tableView.deleteRows(at: [indexPath], with: .automatic)
            
            self.delegate?.taskListDidDelete(taskId: task.id)
            completion(true)
        }
        deleteAction.image = UIImage(systemName: "trash.fill")
        deleteAction.backgroundColor = UIColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0)
        
        return UISwipeActionsConfiguration(actions: [deleteAction])
    }
    
    func tableView(_ tableView: UITableView, leadingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let completeAction = UIContextualAction(style: .normal, title: nil) { [weak self] _, _, completion in
            guard let self = self else { return }
            let task = self.sections[indexPath.section].tasks[indexPath.row]
            
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            
            self.delegate?.taskListDidToggle(taskId: task.id, completed: !task.completed)
            completion(true)
        }
        completeAction.image = UIImage(systemName: "checkmark.circle.fill")
        completeAction.backgroundColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1.0)
        
        return UISwipeActionsConfiguration(actions: [completeAction])
    }
}

// MARK: - UITableViewDragDelegate

extension NativeTaskListView: UITableViewDragDelegate {
    
    func tableView(_ tableView: UITableView, itemsForBeginning session: UIDragSession, at indexPath: IndexPath) -> [UIDragItem] {
        // Native haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
        
        let task = sections[indexPath.section].tasks[indexPath.row]
        let itemProvider = NSItemProvider(object: task.id as NSString)
        let dragItem = UIDragItem(itemProvider: itemProvider)
        dragItem.localObject = task
        
        return [dragItem]
    }
    
    func tableView(_ tableView: UITableView, dragPreviewParametersForRowAt indexPath: IndexPath) -> UIDragPreviewParameters? {
        let parameters = UIDragPreviewParameters()
        parameters.backgroundColor = .clear
        
        if let cell = tableView.cellForRow(at: indexPath) as? TaskTableViewCell {
            // Use the cell's container bounds for the preview
            parameters.visiblePath = UIBezierPath(roundedRect: cell.bounds.insetBy(dx: 16, dy: 4), cornerRadius: 12)
        }
        
        return parameters
    }
}

// MARK: - UITableViewDropDelegate

extension NativeTaskListView: UITableViewDropDelegate {
    
    func tableView(_ tableView: UITableView, dropSessionDidUpdate session: UIDropSession, withDestinationIndexPath destinationIndexPath: IndexPath?) -> UITableViewDropProposal {
        if tableView.hasActiveDrag {
            return UITableViewDropProposal(operation: .move, intent: .insertAtDestinationIndexPath)
        }
        return UITableViewDropProposal(operation: .forbidden)
    }
    
    func tableView(_ tableView: UITableView, performDropWith coordinator: UITableViewDropCoordinator) {
        // Drop is handled by moveRowAt delegate method
        // Just trigger haptic for drop
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
    
    func tableView(_ tableView: UITableView, dropSessionDidEnd session: UIDropSession) {
        // Final haptic feedback when drop completes
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
}
