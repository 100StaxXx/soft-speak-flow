import Foundation
import Capacitor
import UIKit

@objc(NativeTaskListPlugin)
public class NativeTaskListPlugin: CAPPlugin, CAPBridgedPlugin, NativeTaskListViewDelegate {
    
    public let identifier = "NativeTaskListPlugin"
    public let jsName = "NativeTaskList"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showTaskList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateTasks", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideTaskList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise)
    ]
    
    private var taskListView: NativeTaskListView?
    
    // MARK: - Plugin Methods
    
    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }
    
    @objc func showTaskList(_ call: CAPPluginCall) {
        guard let tasksArray = call.getArray("tasks") as? [[String: Any]] else {
            call.reject("Tasks array is required")
            return
        }
        
        let frame = call.getObject("frame") ?? [:]
        let x = frame["x"] as? CGFloat ?? 0
        let y = frame["y"] as? CGFloat ?? 0
        let width = frame["width"] as? CGFloat ?? UIScreen.main.bounds.width
        let height = frame["height"] as? CGFloat ?? 400
        
        let tasks = tasksArray.map { TaskItem(from: $0) }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            // Remove existing view if any
            self.taskListView?.removeFromSuperview()
            
            // Create new task list view
            let listView = NativeTaskListView(frame: CGRect(x: x, y: y, width: width, height: height))
            listView.delegate = self
            listView.updateTasks(tasks)
            
            // Add to the bridge's webView's superview
            if let webView = self.bridge?.webView,
               let parentView = webView.superview {
                parentView.addSubview(listView)
                
                // Setup constraints
                listView.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    listView.leadingAnchor.constraint(equalTo: parentView.leadingAnchor, constant: x),
                    listView.topAnchor.constraint(equalTo: parentView.topAnchor, constant: y),
                    listView.widthAnchor.constraint(equalToConstant: width),
                    listView.heightAnchor.constraint(equalToConstant: height)
                ])
            }
            
            self.taskListView = listView
            call.resolve()
        }
    }
    
    @objc func updateTasks(_ call: CAPPluginCall) {
        guard let tasksArray = call.getArray("tasks") as? [[String: Any]] else {
            call.reject("Tasks array is required")
            return
        }
        
        let tasks = tasksArray.map { TaskItem(from: $0) }
        
        DispatchQueue.main.async { [weak self] in
            self?.taskListView?.updateTasks(tasks)
            call.resolve()
        }
    }
    
    @objc func hideTaskList(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            UIView.animate(withDuration: 0.2, animations: {
                self?.taskListView?.alpha = 0
            }, completion: { _ in
                self?.taskListView?.removeFromSuperview()
                self?.taskListView = nil
            })
            call.resolve()
        }
    }
    
    // MARK: - NativeTaskListViewDelegate
    
    func taskListDidReorder(taskIds: [String]) {
        notifyListeners("tasksReordered", data: ["taskIds": taskIds])
    }
    
    func taskListDidToggle(taskId: String, completed: Bool) {
        notifyListeners("taskToggled", data: ["taskId": taskId, "completed": completed])
    }
    
    func taskListDidDelete(taskId: String) {
        notifyListeners("taskDeleted", data: ["taskId": taskId])
    }
}
