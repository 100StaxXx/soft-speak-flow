import UIKit

class TaskTableViewCell: UITableViewCell {
    
    static let identifier = "TaskTableViewCell"
    
    private var taskId: String = ""
    var onToggle: ((String, Bool) -> Void)?
    
    // MARK: - UI Elements
    
    private let containerView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(red: 0.16, green: 0.16, blue: 0.18, alpha: 1.0) // #28282E
        view.layer.cornerRadius = 12
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private let checkboxButton: UIButton = {
        let button = UIButton(type: .custom)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.layer.cornerRadius = 11
        button.layer.borderWidth = 2
        button.layer.borderColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1.0).cgColor // #22c55e
        button.backgroundColor = .clear
        return button
    }()
    
    private let taskLabel: UILabel = {
        let label = UILabel()
        label.textColor = .white
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.numberOfLines = 2
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let xpBadge: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 0.2)
        view.layer.cornerRadius = 8
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private let xpLabel: UILabel = {
        let label = UILabel()
        label.textColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1.0)
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let difficultyDot: UIView = {
        let view = UIView()
        view.layer.cornerRadius = 4
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private let categoryBadge: UIView = {
        let view = UIView()
        view.layer.cornerRadius = 6
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private let categoryIcon: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 10)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let mainQuestIndicator: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor(red: 0.98, green: 0.78, blue: 0.24, alpha: 1.0) // gold
        view.layer.cornerRadius = 2
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()
    
    private let gripIcon: UIImageView = {
        let config = UIImage.SymbolConfiguration(pointSize: 14, weight: .regular)
        let image = UIImage(systemName: "line.3.horizontal", withConfiguration: config)
        let imageView = UIImageView(image: image)
        imageView.tintColor = UIColor(white: 0.4, alpha: 1.0)
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    // MARK: - Init
    
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        backgroundColor = .clear
        selectionStyle = .none
        
        contentView.addSubview(containerView)
        containerView.addSubview(checkboxButton)
        containerView.addSubview(taskLabel)
        containerView.addSubview(xpBadge)
        xpBadge.addSubview(xpLabel)
        containerView.addSubview(difficultyDot)
        containerView.addSubview(categoryBadge)
        categoryBadge.addSubview(categoryIcon)
        containerView.addSubview(mainQuestIndicator)
        containerView.addSubview(gripIcon)
        
        NSLayoutConstraint.activate([
            // Container
            containerView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            containerView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            containerView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            containerView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4),
            containerView.heightAnchor.constraint(greaterThanOrEqualToConstant: 56),
            
            // Main quest indicator (left edge)
            mainQuestIndicator.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            mainQuestIndicator.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 8),
            mainQuestIndicator.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -8),
            mainQuestIndicator.widthAnchor.constraint(equalToConstant: 4),
            
            // Checkbox
            checkboxButton.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 12),
            checkboxButton.centerYAnchor.constraint(equalTo: containerView.centerYAnchor),
            checkboxButton.widthAnchor.constraint(equalToConstant: 22),
            checkboxButton.heightAnchor.constraint(equalToConstant: 22),
            
            // Task label
            taskLabel.leadingAnchor.constraint(equalTo: checkboxButton.trailingAnchor, constant: 12),
            taskLabel.centerYAnchor.constraint(equalTo: containerView.centerYAnchor),
            taskLabel.trailingAnchor.constraint(equalTo: xpBadge.leadingAnchor, constant: -8),
            
            // Grip icon (right side)
            gripIcon.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -12),
            gripIcon.centerYAnchor.constraint(equalTo: containerView.centerYAnchor),
            gripIcon.widthAnchor.constraint(equalToConstant: 20),
            
            // XP Badge
            xpBadge.trailingAnchor.constraint(equalTo: gripIcon.leadingAnchor, constant: -8),
            xpBadge.centerYAnchor.constraint(equalTo: containerView.centerYAnchor),
            xpBadge.heightAnchor.constraint(equalToConstant: 20),
            
            xpLabel.leadingAnchor.constraint(equalTo: xpBadge.leadingAnchor, constant: 6),
            xpLabel.trailingAnchor.constraint(equalTo: xpBadge.trailingAnchor, constant: -6),
            xpLabel.centerYAnchor.constraint(equalTo: xpBadge.centerYAnchor),
            
            // Difficulty dot
            difficultyDot.trailingAnchor.constraint(equalTo: xpBadge.leadingAnchor, constant: -6),
            difficultyDot.centerYAnchor.constraint(equalTo: containerView.centerYAnchor),
            difficultyDot.widthAnchor.constraint(equalToConstant: 8),
            difficultyDot.heightAnchor.constraint(equalToConstant: 8),
            
            // Category badge
            categoryBadge.trailingAnchor.constraint(equalTo: difficultyDot.leadingAnchor, constant: -6),
            categoryBadge.centerYAnchor.constraint(equalTo: containerView.centerYAnchor),
            categoryBadge.widthAnchor.constraint(equalToConstant: 20),
            categoryBadge.heightAnchor.constraint(equalToConstant: 20),
            
            categoryIcon.centerXAnchor.constraint(equalTo: categoryBadge.centerXAnchor),
            categoryIcon.centerYAnchor.constraint(equalTo: categoryBadge.centerYAnchor),
        ])
        
        checkboxButton.addTarget(self, action: #selector(checkboxTapped), for: .touchUpInside)
    }
    
    // MARK: - Configure
    
    func configure(with task: TaskItem) {
        taskId = task.id
        taskLabel.text = task.task_text
        xpLabel.text = "+\(task.xp_reward)"
        
        // Completed state
        if task.completed {
            checkboxButton.backgroundColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1.0)
            checkboxButton.setImage(UIImage(systemName: "checkmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .bold)), for: .normal)
            checkboxButton.tintColor = .white
            taskLabel.textColor = UIColor(white: 0.5, alpha: 1.0)
            taskLabel.attributedText = NSAttributedString(
                string: task.task_text,
                attributes: [.strikethroughStyle: NSUnderlineStyle.single.rawValue]
            )
        } else {
            checkboxButton.backgroundColor = .clear
            checkboxButton.setImage(nil, for: .normal)
            taskLabel.textColor = .white
            taskLabel.attributedText = nil
            taskLabel.text = task.task_text
        }
        
        // Main quest indicator
        mainQuestIndicator.isHidden = !task.is_main_quest
        
        // Difficulty
        if let difficulty = task.difficulty {
            difficultyDot.isHidden = false
            switch difficulty {
            case "easy":
                difficultyDot.backgroundColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 1.0)
            case "medium":
                difficultyDot.backgroundColor = UIColor(red: 0.98, green: 0.78, blue: 0.24, alpha: 1.0)
            case "hard":
                difficultyDot.backgroundColor = UIColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0)
            default:
                difficultyDot.isHidden = true
            }
        } else {
            difficultyDot.isHidden = true
        }
        
        // Category
        if let category = task.category {
            categoryBadge.isHidden = false
            switch category {
            case "mind":
                categoryBadge.backgroundColor = UIColor(red: 0.53, green: 0.39, blue: 0.95, alpha: 0.2)
                categoryIcon.text = "🧠"
            case "body":
                categoryBadge.backgroundColor = UIColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 0.2)
                categoryIcon.text = "💪"
            case "soul":
                categoryBadge.backgroundColor = UIColor(red: 0.13, green: 0.77, blue: 0.37, alpha: 0.2)
                categoryIcon.text = "✨"
            default:
                categoryBadge.isHidden = true
            }
        } else {
            categoryBadge.isHidden = true
        }
    }
    
    // MARK: - Actions
    
    @objc private func checkboxTapped() {
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
        onToggle?(taskId, true)
    }
    
    // MARK: - Drag Appearance
    
    override func setHighlighted(_ highlighted: Bool, animated: Bool) {
        super.setHighlighted(highlighted, animated: animated)
        UIView.animate(withDuration: 0.2) {
            self.containerView.transform = highlighted ? CGAffineTransform(scaleX: 1.02, y: 1.02) : .identity
            self.containerView.layer.shadowOpacity = highlighted ? 0.3 : 0
            self.containerView.layer.shadowRadius = highlighted ? 8 : 0
            self.containerView.layer.shadowOffset = CGSize(width: 0, height: 4)
            self.containerView.layer.shadowColor = UIColor.black.cgColor
        }
    }
}
